using AbhiTimesheet.Api.Contracts.Chat;
using AbhiTimesheet.Api.Data;
using AbhiTimesheet.Api.Infrastructure;
using AbhiTimesheet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AbhiTimesheet.Api.Services;

public sealed class ChatService(
    AppDbContext dbContext,
    ILogger<ChatService> logger)
{
    private static readonly string[] SupportRoles = ["HR Manager", "Finance Admin", "System Admin"];
    private static readonly SemaphoreSlim FoundationSyncLock = new(1, 1);
    private static readonly TimeSpan FoundationSyncCooldown = TimeSpan.FromSeconds(30);
    private static DateTime lastFoundationSyncAtUtc = DateTime.MinValue;

    public async Task EnsureFoundationsAsync()
    {
        var now = DateTime.UtcNow;
        if (now - lastFoundationSyncAtUtc < FoundationSyncCooldown)
        {
            return;
        }

        if (!await FoundationSyncLock.WaitAsync(0))
        {
            return;
        }

        try
        {
            now = DateTime.UtcNow;
            if (now - lastFoundationSyncAtUtc < FoundationSyncCooldown)
            {
                return;
            }

            try
            {
                await RunFoundationSyncAsync(EnsureDepartmentThreadsAsync);
                await RunFoundationSyncAsync(EnsureProjectThreadsAsync);
                lastFoundationSyncAtUtc = DateTime.UtcNow;
            }
            catch (DbUpdateConcurrencyException exception)
            {
                dbContext.ChangeTracker.Clear();
                lastFoundationSyncAtUtc = DateTime.UtcNow;
                logger.LogWarning(
                    exception,
                    "Chat foundation synchronization hit a concurrency race during a request and was skipped. Existing chat data will continue to load.");
            }
        }
        finally
        {
            FoundationSyncLock.Release();
        }
    }

    public async Task<IReadOnlyList<ChatThreadDto>> GetThreadsAsync(Guid currentUserId)
    {
        var threadIds = await dbContext.ChatParticipants
            .AsNoTracking()
            .Where(item => item.UserId == currentUserId && item.IsActive)
            .Select(item => item.ChatThreadId)
            .Distinct()
            .ToListAsync();

        return await BuildThreadDtosAsync(currentUserId, threadIds);
    }

    public async Task<ChatThreadDto?> GetThreadAsync(Guid threadId, Guid currentUserId)
    {
        var threadIds = await dbContext.ChatParticipants
            .AsNoTracking()
            .Where(item => item.ChatThreadId == threadId && item.UserId == currentUserId && item.IsActive)
            .Select(item => item.ChatThreadId)
            .ToListAsync();

        return (await BuildThreadDtosAsync(currentUserId, threadIds)).FirstOrDefault();
    }

    public async Task<IReadOnlyList<ChatMessageDto>> GetMessagesAsync(Guid threadId, Guid currentUserId, int take)
    {
        if (!await IsActiveParticipantAsync(threadId, currentUserId))
        {
            return [];
        }

        var normalizedTake = Math.Clamp(take, 1, 120);
        var messages = await dbContext.ChatMessages
            .AsNoTracking()
            .Include(item => item.Attachments.Where(attachment => !attachment.IsDeleted))
            .Include(item => item.Reactions)
            .Where(item => item.ChatThreadId == threadId && !item.IsDeleted)
            .OrderByDescending(item => item.CreatedAtUtc)
            .Take(normalizedTake)
            .OrderBy(item => item.CreatedAtUtc)
            .ToListAsync();

        var senderIds = messages
            .Where(item => item.SenderUserId.HasValue)
            .Select(item => item.SenderUserId!.Value)
            .Distinct()
            .ToList();

        var senderLookup = await LoadEmployeeLookupAsync(senderIds);
        return messages.Select(item => MapMessage(item, senderLookup, currentUserId)).ToList();
    }

    public async Task<ChatContactDirectoryDto> GetContactsAsync(Guid currentUserId)
    {
        var currentUser = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == currentUserId && item.Status == "Active");

        if (currentUser is null)
        {
            return new ChatContactDirectoryDto([], [], [], [], []);
        }

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(item => item.Status == "Active")
            .OrderBy(item => item.FullName)
            .ToListAsync();

        var activeProjects = await dbContext.Projects
            .AsNoTracking()
            .ToListAsync();

        var employeesById = employees.ToDictionary(item => item.Id);
        var projectMembership = activeProjects
            .Where(project => IsProjectVisibleToUser(project, currentUserId))
            .SelectMany(project =>
            {
                var memberIds = ParseParticipantIds(project);
                return memberIds
                    .Where(memberId => memberId != currentUserId)
                    .Select(memberId => new
                    {
                        UserId = memberId,
                        Context = $"Project: {project.Name}"
                    });
            })
            .GroupBy(item => item.UserId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.Context).Distinct(StringComparer.OrdinalIgnoreCase).ToList());

        var teamMembers = employees
            .Where(item =>
                item.Id != currentUserId &&
                string.Equals(item.Department, currentUser.Department, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var hierarchyIds = new HashSet<Guid>();
        if (currentUser.ReportingManagerId.HasValue)
        {
            hierarchyIds.Add(currentUser.ReportingManagerId.Value);
        }

        foreach (var subordinateId in employees
                     .Where(item => item.ReportingManagerId == currentUserId && item.Id != currentUserId)
                     .Select(item => item.Id))
        {
            hierarchyIds.Add(subordinateId);
        }

        var supportIds = employees
            .Where(item =>
                item.Id != currentUserId &&
                RoleCatalog.HasAnyRole(item.RolesJson, SupportRoles, item.Role))
            .Select(item => item.Id)
            .ToHashSet();

        var currentUserPrimaryRole = RoleCatalog.GetPrimaryRole(currentUser.RolesJson, currentUser.Role);
        var directoryIds = currentUserPrimaryRole switch
        {
            "HR Manager" or "System Admin" => employees
                .Where(item => item.Id != currentUserId)
                .Select(item => item.Id)
                .ToHashSet(),
            "Team Manager" => employees
                .Where(item =>
                    item.Id != currentUserId &&
                    (item.ReportingManagerId == currentUserId ||
                     string.Equals(item.Department, currentUser.Department, StringComparison.OrdinalIgnoreCase)))
                .Select(item => item.Id)
                .ToHashSet(),
            _ => new HashSet<Guid>()
        };

        IReadOnlyList<ChatContactDto> BuildContacts(IEnumerable<Guid> ids, Func<Guid, string> contextLabel) =>
            ids
                .Distinct()
                .Where(id => employeesById.ContainsKey(id))
                .Select(id => MapContact(employeesById[id], contextLabel(id)))
                .OrderBy(item => item.FullName)
                .ToList();

        return new ChatContactDirectoryDto(
            BuildContacts(projectMembership.Keys, id =>
            {
                var labels = projectMembership[id];
                return labels.Count == 1 ? labels[0] : $"{labels[0]} +{labels.Count - 1} more";
            }),
            teamMembers.Select(item => item.Id).Any()
                ? BuildContacts(teamMembers.Select(item => item.Id), _ => $"Team: {currentUser.Department}")
                : [],
            hierarchyIds.Count > 0
                ? BuildContacts(hierarchyIds, id =>
                {
                    if (currentUser.ReportingManagerId == id)
                    {
                        return "Reporting manager";
                    }

                    return "Direct report";
                })
                : [],
            supportIds.Count > 0
                ? BuildContacts(supportIds, id => $"{RoleCatalog.FormatRoles(employeesById[id].RolesJson, employeesById[id].Role)} support")
                : [],
            directoryIds.Count > 0
                ? BuildContacts(directoryIds, _ => "Employee directory")
                : []);
    }

    public async Task<ChatThreadDto?> EnsureDirectThreadAsync(Guid currentUserId, Guid otherUserId)
    {
        if (currentUserId == otherUserId)
        {
            return null;
        }

        var validUserIds = await dbContext.Employees
            .AsNoTracking()
            .Where(item =>
                item.Status == "Active" &&
                (item.Id == currentUserId || item.Id == otherUserId))
            .Select(item => item.Id)
            .ToListAsync();

        if (!validUserIds.Contains(currentUserId) || !validUserIds.Contains(otherUserId))
        {
            return null;
        }

        var existingThread = await dbContext.ChatThreads
            .Include(item => item.Participants)
            .FirstOrDefaultAsync(item =>
                item.ThreadType == "Direct" &&
                item.IsActive &&
                !item.IsArchived &&
                item.Participants.Count(participant => participant.IsActive) == 2 &&
                item.Participants.Any(participant => participant.IsActive && participant.UserId == currentUserId) &&
                item.Participants.Any(participant => participant.IsActive && participant.UserId == otherUserId));

        if (existingThread is null)
        {
            var now = DateTime.UtcNow;
            existingThread = new ChatThreadEntity
            {
                Id = Guid.NewGuid(),
                ThreadType = "Direct",
                Name = string.Empty,
                CreatedByUserId = currentUserId,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
                IsActive = true,
                IsArchived = false
            };

            existingThread.Participants.Add(new ChatParticipantEntity
            {
                Id = Guid.NewGuid(),
                UserId = currentUserId,
                RoleInThread = "Owner",
                JoinedAtUtc = now,
                IsMuted = false,
                IsPinned = false,
                IsActive = true
            });
            existingThread.Participants.Add(new ChatParticipantEntity
            {
                Id = Guid.NewGuid(),
                UserId = otherUserId,
                RoleInThread = "Member",
                JoinedAtUtc = now,
                IsMuted = false,
                IsPinned = false,
                IsActive = true
            });

            dbContext.ChatThreads.Add(existingThread);
            await dbContext.SaveChangesAsync();
        }

        return await GetThreadAsync(existingThread.Id, currentUserId);
    }

    public async Task<ChatThreadDto?> CreateGroupThreadAsync(Guid currentUserId, CreateChatGroupRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        var threadType = NormalizeGroupThreadType(request.ThreadType);
        if (threadType is null)
        {
            return null;
        }

        var participantIds = request.ParticipantUserIds
            .Select(TryParseGuid)
            .Where(item => item.HasValue)
            .Select(item => item!.Value)
            .Append(currentUserId)
            .Distinct()
            .ToList();

        var validUsers = await dbContext.Employees
            .AsNoTracking()
            .Where(item => item.Status == "Active" && participantIds.Contains(item.Id))
            .Select(item => item.Id)
            .ToListAsync();

        if (!validUsers.Contains(currentUserId) || validUsers.Count < 2)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var thread = new ChatThreadEntity
        {
            Id = Guid.NewGuid(),
            ThreadType = threadType,
            Name = name,
            Description = request.Description?.Trim(),
            CreatedByUserId = currentUserId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            IsActive = true,
            IsArchived = false
        };

        foreach (var participantId in validUsers)
        {
            thread.Participants.Add(new ChatParticipantEntity
            {
                Id = Guid.NewGuid(),
                UserId = participantId,
                RoleInThread = participantId == currentUserId ? "Owner" : "Member",
                JoinedAtUtc = now,
                IsMuted = false,
                IsPinned = false,
                IsActive = true
            });
        }

        thread.Messages.Add(CreateSystemMessage(thread.Id, $"{name} created."));
        dbContext.ChatThreads.Add(thread);
        await dbContext.SaveChangesAsync();

        return await GetThreadAsync(thread.Id, currentUserId);
    }

    public async Task<ChatMessageDto?> SendMessageAsync(Guid currentUserId, SendChatMessageRequest request)
    {
        if (!Guid.TryParse(request.ThreadId, out var threadId))
        {
            return null;
        }

        var thread = await dbContext.ChatThreads
            .Include(item => item.Participants)
            .FirstOrDefaultAsync(item => item.Id == threadId && item.IsActive && !item.IsArchived);

        if (thread is null)
        {
            return null;
        }

        var participant = thread.Participants.FirstOrDefault(item => item.UserId == currentUserId && item.IsActive);
        if (participant is null)
        {
            return null;
        }

        var messageText = request.MessageText.Trim();
        if (string.IsNullOrWhiteSpace(messageText))
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var message = new ChatMessageEntity
        {
            Id = Guid.NewGuid(),
            ChatThreadId = threadId,
            SenderUserId = currentUserId,
            MessageType = NormalizeMessageType(request.MessageType),
            MessageText = messageText,
            MessageStatus = "Sent",
            ReplyToMessageId = TryParseGuid(request.ReplyToMessageId),
            ForwardedFromMessageId = TryParseGuid(request.ForwardedFromMessageId),
            DeliveredAtUtc = now,
            CreatedAtUtc = now
        };

        participant.LastSeenAtUtc = now;
        participant.LastSeenMessageId = message.Id;
        thread.UpdatedAtUtc = now;

        dbContext.ChatMessages.Add(message);
        if (request.AttachmentIds is { Count: > 0 })
        {
            var attachmentIds = request.AttachmentIds
                .Select(TryParseGuid)
                .Where(item => item.HasValue)
                .Select(item => item!.Value)
                .ToList();

            var attachments = await dbContext.ChatAttachments
                .Where(item => attachmentIds.Contains(item.Id) && item.UploadedByUserId == currentUserId && item.ChatMessageId == null)
                .ToListAsync();

            foreach (var attachment in attachments)
            {
                attachment.ChatMessageId = message.Id;
            }
        }

        await dbContext.SaveChangesAsync();

        var senderLookup = await LoadEmployeeLookupAsync([currentUserId]);
        return MapMessage(message, senderLookup, currentUserId);
    }

    public async Task<ChatMessageDto?> UpdateMessageAsync(Guid currentUserId, Guid messageId, UpdateChatMessageRequest request)
    {
        var message = await dbContext.ChatMessages
            .Include(item => item.Attachments.Where(attachment => !attachment.IsDeleted))
            .Include(item => item.Reactions)
            .FirstOrDefaultAsync(item => item.Id == messageId && !item.IsDeleted);

        if (message is null || message.SenderUserId != currentUserId || !await IsActiveParticipantAsync(message.ChatThreadId, currentUserId))
        {
            return null;
        }

        var text = request.MessageText.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 4000)
        {
            return null;
        }

        message.MessageText = text;
        message.EditedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        var senderLookup = await LoadEmployeeLookupAsync([currentUserId]);
        return MapMessage(message, senderLookup, currentUserId);
    }

    public async Task<bool> DeleteMessageForEveryoneAsync(Guid currentUserId, Guid messageId)
    {
        var message = await dbContext.ChatMessages.FirstOrDefaultAsync(item => item.Id == messageId && !item.IsDeleted);
        if (message is null || message.SenderUserId != currentUserId || !await IsActiveParticipantAsync(message.ChatThreadId, currentUserId))
        {
            return false;
        }

        message.IsDeleted = true;
        message.DeletedAtUtc = DateTime.UtcNow;
        message.DeletedByUserId = currentUserId;
        message.MessageText = "This message was deleted.";
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<ChatMessageDto?> ToggleReactionAsync(Guid currentUserId, Guid messageId, ChatReactionRequest request)
    {
        var emoji = request.Emoji.Trim();
        if (string.IsNullOrWhiteSpace(emoji) || emoji.Length > 32)
        {
            return null;
        }

        var message = await dbContext.ChatMessages
            .Include(item => item.Attachments.Where(attachment => !attachment.IsDeleted))
            .Include(item => item.Reactions)
            .FirstOrDefaultAsync(item => item.Id == messageId && !item.IsDeleted);

        if (message is null || !await IsActiveParticipantAsync(message.ChatThreadId, currentUserId))
        {
            return null;
        }

        var existing = message.Reactions.FirstOrDefault(item => item.UserId == currentUserId && item.Emoji == emoji);
        if (existing is null)
        {
            message.Reactions.Add(new ChatReactionEntity
            {
                Id = Guid.NewGuid(),
                ChatMessageId = message.Id,
                UserId = currentUserId,
                Emoji = emoji,
                CreatedAtUtc = DateTime.UtcNow
            });
        }
        else
        {
            dbContext.ChatReactions.Remove(existing);
        }

        await dbContext.SaveChangesAsync();
        await dbContext.Entry(message).Collection(item => item.Reactions).LoadAsync();
        var senderLookup = await LoadEmployeeLookupAsync(message.SenderUserId.HasValue ? [message.SenderUserId.Value] : []);
        return MapMessage(message, senderLookup, currentUserId);
    }

    public async Task<bool> ToggleMessagePinAsync(Guid currentUserId, Guid messageId, bool pinned)
    {
        var message = await dbContext.ChatMessages.FirstOrDefaultAsync(item => item.Id == messageId && !item.IsDeleted);
        if (message is null || !await CanManageThreadAsync(message.ChatThreadId, currentUserId))
        {
            return false;
        }

        message.IsPinned = pinned;
        message.PinnedByUserId = pinned ? currentUserId : null;
        message.PinnedAtUtc = pinned ? DateTime.UtcNow : null;
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> MarkThreadAsSeenAsync(Guid threadId, Guid currentUserId)
    {
        var participant = await dbContext.ChatParticipants
            .FirstOrDefaultAsync(item =>
                item.ChatThreadId == threadId &&
                item.UserId == currentUserId &&
                item.IsActive);

        if (participant is null)
        {
            return false;
        }

        var lastMessage = await dbContext.ChatMessages
            .AsNoTracking()
            .Where(item => item.ChatThreadId == threadId && !item.IsDeleted)
            .OrderByDescending(item => item.CreatedAtUtc)
            .FirstOrDefaultAsync();

        participant.LastSeenAtUtc = DateTime.UtcNow;
        participant.LastSeenMessageId = lastMessage?.Id;
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<ChatThreadDto?> UpdateThreadAsync(Guid currentUserId, Guid threadId, UpdateThreadRequest request)
    {
        if (!await CanManageThreadAsync(threadId, currentUserId))
        {
            return null;
        }

        var thread = await dbContext.ChatThreads.FirstOrDefaultAsync(item => item.Id == threadId && item.IsActive && !item.IsArchived);
        if (thread is null || thread.ThreadType == "Direct")
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            thread.Name = request.Name.Trim()[..Math.Min(request.Name.Trim().Length, 200)];
        }

        thread.Description = request.Description?.Trim();
        thread.PhotoUrl = request.PhotoUrl?.Trim();
        thread.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        return await GetThreadAsync(threadId, currentUserId);
    }

    public async Task<bool> UpdateThreadPreferenceAsync(Guid currentUserId, Guid threadId, bool? pinned, bool? muted)
    {
        var participant = await dbContext.ChatParticipants.FirstOrDefaultAsync(item => item.ChatThreadId == threadId && item.UserId == currentUserId && item.IsActive);
        if (participant is null)
        {
            return false;
        }

        if (pinned.HasValue)
        {
            participant.IsPinned = pinned.Value;
        }

        if (muted.HasValue)
        {
            participant.IsMuted = muted.Value;
        }

        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ArchiveThreadAsync(Guid currentUserId, Guid threadId)
    {
        if (!await CanManageThreadAsync(threadId, currentUserId))
        {
            return false;
        }

        var thread = await dbContext.ChatThreads.FirstOrDefaultAsync(item => item.Id == threadId && item.IsActive && !item.IsArchived);
        if (thread is null)
        {
            return false;
        }

        thread.IsArchived = true;
        thread.IsActive = false;
        thread.ArchivedByUserId = currentUserId;
        thread.ArchivedAtUtc = DateTime.UtcNow;
        thread.UpdatedAtUtc = DateTime.UtcNow;
        dbContext.ChatMessages.Add(CreateSystemMessage(thread.Id, "Conversation archived.", currentUserId));
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> LeaveThreadAsync(Guid currentUserId, Guid threadId)
    {
        var participant = await dbContext.ChatParticipants.FirstOrDefaultAsync(item => item.ChatThreadId == threadId && item.UserId == currentUserId && item.IsActive);
        if (participant is null)
        {
            return false;
        }

        participant.IsActive = false;
        dbContext.ChatMessages.Add(CreateSystemMessage(threadId, "A participant left the conversation.", currentUserId));
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveParticipantAsync(Guid currentUserId, Guid threadId, Guid userId)
    {
        if (!await CanManageThreadAsync(threadId, currentUserId) || userId == currentUserId)
        {
            return false;
        }

        var participant = await dbContext.ChatParticipants.FirstOrDefaultAsync(item => item.ChatThreadId == threadId && item.UserId == userId && item.IsActive);
        if (participant is null)
        {
            return false;
        }

        participant.IsActive = false;
        dbContext.ChatMessages.Add(CreateSystemMessage(threadId, "A participant was removed from the conversation.", currentUserId));
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateParticipantRoleAsync(Guid currentUserId, Guid threadId, UpdateThreadParticipantRequest request)
    {
        if (!await CanManageThreadAsync(threadId, currentUserId) || !Guid.TryParse(request.UserId, out var userId))
        {
            return false;
        }

        var role = NormalizeThreadRole(request.RoleInThread);
        if (role is null)
        {
            return false;
        }

        var participant = await dbContext.ChatParticipants.FirstOrDefaultAsync(item => item.ChatThreadId == threadId && item.UserId == userId && item.IsActive);
        if (participant is null)
        {
            return false;
        }

        participant.RoleInThread = role;
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<ChatAttachmentDto?> RegisterAttachmentAsync(Guid currentUserId, string fileName, string originalFileName, string contentType, long size, string storagePath, string publicUrl)
    {
        var now = DateTime.UtcNow;
        var attachment = new ChatAttachmentEntity
        {
            Id = Guid.NewGuid(),
            UploadedByUserId = currentUserId,
            FileName = fileName,
            OriginalFileName = originalFileName,
            ContentType = contentType,
            FileSizeBytes = size,
            StoragePath = storagePath,
            PublicUrl = publicUrl,
            AttachmentType = contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ? "Image" : "File",
            ScanStatus = "Pending",
            PreviewUrl = contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ? publicUrl : null,
            CreatedAtUtc = now
        };

        dbContext.ChatAttachments.Add(attachment);
        await dbContext.SaveChangesAsync();
        return MapAttachment(attachment);
    }

    public async Task<ChatPresenceDto> UpdatePresenceAsync(Guid currentUserId, UpdatePresenceRequest request)
    {
        var now = DateTime.UtcNow;
        var presence = await dbContext.ChatPresences.FirstOrDefaultAsync(item => item.UserId == currentUserId);
        var isNew = presence is null;
        
        presence ??= new ChatPresenceEntity { UserId = currentUserId };
        presence.PresenceStatus = NormalizePresenceStatus(request.PresenceStatus);
        presence.ActiveThreadId = TryParseGuid(request.ActiveThreadId);
        presence.IsTyping = request.IsTyping;
        presence.LastSeenAtUtc = now;
        presence.UpdatedAtUtc = now;

        if (isNew)
        {
            dbContext.ChatPresences.Add(presence);
        }

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Handle race condition where another request created the record first
            dbContext.ChangeTracker.Clear();
            var existing = await dbContext.ChatPresences.FirstOrDefaultAsync(item => item.UserId == currentUserId);
            if (existing != null)
            {
                existing.PresenceStatus = presence.PresenceStatus;
                existing.ActiveThreadId = presence.ActiveThreadId;
                existing.IsTyping = presence.IsTyping;
                existing.LastSeenAtUtc = presence.LastSeenAtUtc;
                existing.UpdatedAtUtc = presence.UpdatedAtUtc;
                await dbContext.SaveChangesAsync();
                presence = existing;
            }
        }

        return MapPresence(presence);
    }

    public async Task<IReadOnlyList<ChatPresenceDto>> GetThreadPresenceAsync(Guid currentUserId, Guid threadId)
    {
        if (!await IsActiveParticipantAsync(threadId, currentUserId))
        {
            return [];
        }

        var participantIds = await dbContext.ChatParticipants
            .AsNoTracking()
            .Where(item => item.ChatThreadId == threadId && item.IsActive)
            .Select(item => item.UserId)
            .ToListAsync();

        var presences = await dbContext.ChatPresences
            .AsNoTracking()
            .Where(item => participantIds.Contains(item.UserId))
            .ToListAsync();

        return presences.Select(MapPresence).ToList();
    }

    public async Task<ChatNotificationPreferencesDto> GetNotificationPreferencesAsync(Guid currentUserId)
    {
        var preferences = await dbContext.ChatNotificationPreferences.AsNoTracking().FirstOrDefaultAsync(item => item.UserId == currentUserId);
        return preferences is null
            ? new ChatNotificationPreferencesDto(true, true, false, true, true)
            : MapNotificationPreferences(preferences);
    }

    public async Task<ChatNotificationPreferencesDto> UpdateNotificationPreferencesAsync(Guid currentUserId, ChatNotificationPreferencesDto request)
    {
        var preferences = await dbContext.ChatNotificationPreferences.FirstOrDefaultAsync(item => item.UserId == currentUserId);
        var isNew = preferences is null;
        
        preferences ??= new ChatNotificationPreferenceEntity { UserId = currentUserId };
        preferences.BrowserNotificationsEnabled = request.BrowserNotificationsEnabled;
        preferences.SoundEnabled = request.SoundEnabled;
        preferences.EmailNotificationsEnabled = request.EmailNotificationsEnabled;
        preferences.MentionNotificationsEnabled = request.MentionNotificationsEnabled;
        preferences.OfflineNotificationsEnabled = request.OfflineNotificationsEnabled;
        preferences.UpdatedAtUtc = DateTime.UtcNow;

        if (isNew)
        {
            dbContext.ChatNotificationPreferences.Add(preferences);
        }

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
            var existing = await dbContext.ChatNotificationPreferences.FirstOrDefaultAsync(item => item.UserId == currentUserId);
            if (existing != null)
            {
                existing.BrowserNotificationsEnabled = preferences.BrowserNotificationsEnabled;
                existing.SoundEnabled = preferences.SoundEnabled;
                existing.EmailNotificationsEnabled = preferences.EmailNotificationsEnabled;
                existing.MentionNotificationsEnabled = preferences.MentionNotificationsEnabled;
                existing.OfflineNotificationsEnabled = preferences.OfflineNotificationsEnabled;
                existing.UpdatedAtUtc = preferences.UpdatedAtUtc;
                await dbContext.SaveChangesAsync();
                preferences = existing;
            }
        }

        return MapNotificationPreferences(preferences);
    }

    public async Task SynchronizeProjectThreadAsync(ProjectEntity project, Guid actorUserId)
    {
        var thread = await dbContext.ChatThreads
            .Include(item => item.Participants)
            .FirstOrDefaultAsync(item => item.ProjectId == project.Id && item.ThreadType == "ProjectGroup");

        var now = DateTime.UtcNow;
        var isNewThread = thread is null;
        thread ??= new ChatThreadEntity
        {
            Id = Guid.NewGuid(),
            ThreadType = "ProjectGroup",
            ProjectId = project.Id,
            CreatedByUserId = actorUserId,
            CreatedAtUtc = now,
            IsActive = true,
            IsArchived = false
        };

        thread.Name = $"Project - {project.Name.Trim()}";
        thread.Description = BuildProjectThreadDescription(project);
        thread.UpdatedAtUtc = now;
        thread.IsActive = true;
        thread.IsArchived = false;

        if (isNewThread)
        {
            dbContext.ChatThreads.Add(thread);
        }

        var desiredParticipants = BuildProjectParticipantRoles(project);
        var activeUsers = await LoadEmployeeLookupAsync(desiredParticipants.Keys);
        SynchronizeParticipants(thread, desiredParticipants, activeUsers, actorUserId, now, announceMembershipChanges: !isNewThread);

        if (isNewThread)
        {
            dbContext.ChatMessages.Add(CreateSystemMessage(thread.Id, "Project group created automatically."));
        }

        await dbContext.SaveChangesAsync();
    }

    public async Task ArchiveProjectThreadAsync(Guid projectId, Guid actorUserId)
    {
        var thread = await dbContext.ChatThreads
            .FirstOrDefaultAsync(item => item.ProjectId == projectId && item.ThreadType == "ProjectGroup" && !item.IsArchived);

        if (thread is null)
        {
            return;
        }

        thread.IsArchived = true;
        thread.IsActive = false;
        thread.UpdatedAtUtc = DateTime.UtcNow;
        dbContext.ChatMessages.Add(CreateSystemMessage(thread.Id, "Project archived. Conversation closed.", actorUserId));
        await dbContext.SaveChangesAsync();
    }

    private async Task EnsureProjectThreadsAsync()
    {
        var projects = await dbContext.Projects
            .AsNoTracking()
            .ToListAsync();

        foreach (var project in projects)
        {
            var actorUserId = project.AdminId != Guid.Empty ? project.AdminId : project.ManagerId;
            await SynchronizeProjectThreadAsync(project, actorUserId);
            dbContext.ChangeTracker.Clear();
        }
    }

    private async Task RunFoundationSyncAsync(Func<Task> syncFoundation)
    {
        try
        {
            await syncFoundation();
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.ChangeTracker.Clear();

            try
            {
                await syncFoundation();
            }
            catch (DbUpdateConcurrencyException)
            {
                dbContext.ChangeTracker.Clear();
            }
        }
    }

    private async Task EnsureDepartmentThreadsAsync()
    {
        var activeDepartments = (await dbContext.Departments
            .AsNoTracking()
            .Where(item => item.Status == "Active")
            .OrderBy(item => item.Name)
            .Select(item => item.Name)
            .ToListAsync())
            .Select(item => item.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var activeEmployees = await dbContext.Employees
            .AsNoTracking()
            .Where(item => item.Status == "Active")
            .ToListAsync();

        var employeesById = activeEmployees.ToDictionary(item => item.Id);
        foreach (var departmentName in activeDepartments)
        {
            await EnsureDepartmentThreadAsync(departmentName, activeEmployees, employeesById);
            dbContext.ChangeTracker.Clear();
        }

        var now = DateTime.UtcNow;
        var staleThreads = await dbContext.ChatThreads
            .Include(item => item.Participants)
            .Where(item => item.ThreadType == "TeamGroup")
            .ToListAsync();

        foreach (var staleThread in staleThreads.Where(item =>
                     !activeDepartments.Contains(item.DepartmentName ?? string.Empty, StringComparer.OrdinalIgnoreCase)))
        {
            staleThread.IsArchived = true;
            staleThread.IsActive = false;
            staleThread.UpdatedAtUtc = now;
            foreach (var participant in staleThread.Participants.Where(item => item.IsActive))
            {
                participant.IsActive = false;
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private async Task EnsureDepartmentThreadAsync(
        string normalizedDepartmentName,
        IReadOnlyList<EmployeeEntity> activeEmployees,
        IReadOnlyDictionary<Guid, EmployeeEntity> employeesById)
    {
        var thread = await dbContext.ChatThreads
            .Include(item => item.Participants)
            .FirstOrDefaultAsync(item =>
                item.ThreadType == "TeamGroup" &&
                item.DepartmentName == normalizedDepartmentName);

        var now = DateTime.UtcNow;
        var isNewThread = thread is null;
        thread ??= new ChatThreadEntity
        {
            Id = Guid.NewGuid(),
            ThreadType = "TeamGroup",
            DepartmentName = normalizedDepartmentName,
            CreatedByUserId = activeEmployees
                .FirstOrDefault(item => string.Equals(item.Department, normalizedDepartmentName, StringComparison.OrdinalIgnoreCase))
                ?.Id,
            CreatedAtUtc = now,
            IsActive = true,
            IsArchived = false
        };

        thread.Name = $"Team - {normalizedDepartmentName}";
        thread.Description = $"Department communication space for {normalizedDepartmentName}.";
        thread.DepartmentName = normalizedDepartmentName;
        thread.UpdatedAtUtc = now;
        thread.IsActive = true;
        thread.IsArchived = false;

        if (isNewThread)
        {
            dbContext.ChatThreads.Add(thread);
        }

        var desiredParticipants = activeEmployees
            .Where(item => string.Equals(item.Department, normalizedDepartmentName, StringComparison.OrdinalIgnoreCase))
            .ToDictionary(
                item => item.Id,
                item => RoleCatalog.HasAnyRole(item.RolesJson, [RoleCatalog.TeamManager, RoleCatalog.SystemAdmin], item.Role) ? "Admin" : "Member");

        SynchronizeParticipants(thread, desiredParticipants, employeesById, thread.CreatedByUserId ?? Guid.Empty, now, announceMembershipChanges: false);

        if (isNewThread)
        {
            dbContext.ChatMessages.Add(CreateSystemMessage(thread.Id, "Department team group generated automatically."));
        }

        await dbContext.SaveChangesAsync();
    }

    private void SynchronizeParticipants(
        ChatThreadEntity thread,
        IReadOnlyDictionary<Guid, string> desiredParticipants,
        IReadOnlyDictionary<Guid, EmployeeEntity> activeEmployees,
        Guid actorUserId,
        DateTime now,
        bool announceMembershipChanges)
    {
        var existingByUserId = thread.Participants.ToDictionary(item => item.UserId);

        foreach (var (userId, roleInThread) in desiredParticipants)
        {
            if (!activeEmployees.ContainsKey(userId))
            {
                continue;
            }

            if (existingByUserId.TryGetValue(userId, out var existingParticipant))
            {
                var wasInactive = !existingParticipant.IsActive;
                existingParticipant.IsActive = true;
                existingParticipant.RoleInThread = roleInThread;
                existingParticipant.JoinedAtUtc = wasInactive ? now : existingParticipant.JoinedAtUtc;

                if (announceMembershipChanges && wasInactive)
                {
                    dbContext.ChatMessages.Add(CreateSystemMessage(
                        thread.Id,
                        $"{activeEmployees[userId].FullName} joined the conversation.",
                        actorUserId));
                }

                continue;
            }

            thread.Participants.Add(new ChatParticipantEntity
            {
                Id = Guid.NewGuid(),
                ChatThreadId = thread.Id,
                UserId = userId,
                RoleInThread = roleInThread,
                JoinedAtUtc = now,
                IsMuted = false,
                IsPinned = false,
                IsActive = true
            });

            if (announceMembershipChanges)
            {
                dbContext.ChatMessages.Add(CreateSystemMessage(
                    thread.Id,
                    $"{activeEmployees[userId].FullName} was added to the group.",
                    actorUserId));
            }
        }

        foreach (var participant in thread.Participants.Where(item => item.IsActive).ToList())
        {
            if (desiredParticipants.ContainsKey(participant.UserId))
            {
                continue;
            }

            participant.IsActive = false;
            if (announceMembershipChanges)
            {
                var name = activeEmployees.TryGetValue(participant.UserId, out var employee)
                    ? employee.FullName
                    : "A participant";
                dbContext.ChatMessages.Add(CreateSystemMessage(thread.Id, $"{name} was removed from the group.", actorUserId));
            }
        }
    }

    private async Task<bool> IsActiveParticipantAsync(Guid threadId, Guid currentUserId)
    {
        return await dbContext.ChatParticipants
            .AsNoTracking()
            .AnyAsync(item =>
                item.ChatThreadId == threadId &&
                item.UserId == currentUserId &&
                item.IsActive);
    }

    private async Task<bool> CanManageThreadAsync(Guid threadId, Guid currentUserId)
    {
        var participant = await dbContext.ChatParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.ChatThreadId == threadId && item.UserId == currentUserId && item.IsActive);

        return participant is not null &&
               (string.Equals(participant.RoleInThread, "Owner", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(participant.RoleInThread, "Admin", StringComparison.OrdinalIgnoreCase));
    }

    private async Task<IReadOnlyList<ChatThreadDto>> BuildThreadDtosAsync(Guid currentUserId, IReadOnlyCollection<Guid> threadIds)
    {
        if (threadIds.Count == 0)
        {
            return [];
        }

        var threads = await dbContext.ChatThreads
            .AsNoTracking()
            .Where(item => threadIds.Contains(item.Id) && item.IsActive && !item.IsArchived)
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToListAsync();

        if (threads.Count == 0)
        {
            return [];
        }

        var participants = await dbContext.ChatParticipants
            .AsNoTracking()
            .Where(item => threadIds.Contains(item.ChatThreadId) && item.IsActive)
            .ToListAsync();

        var lastMessages = await dbContext.ChatMessages
            .AsNoTracking()
            .Where(item => threadIds.Contains(item.ChatThreadId) && !item.IsDeleted)
            .GroupBy(item => item.ChatThreadId)
            .Select(group => group
                .OrderByDescending(item => item.CreatedAtUtc)
                .First())
            .ToListAsync();

        var unreadCounts = await (
                from message in dbContext.ChatMessages.AsNoTracking()
                join participant in dbContext.ChatParticipants.AsNoTracking()
                    on message.ChatThreadId equals participant.ChatThreadId
                where threadIds.Contains(message.ChatThreadId) &&
                      participant.UserId == currentUserId &&
                      participant.IsActive &&
                      !message.IsDeleted &&
                      message.SenderUserId != currentUserId &&
                      (!participant.LastSeenAtUtc.HasValue || message.CreatedAtUtc > participant.LastSeenAtUtc.Value)
                group message by message.ChatThreadId
                into groupedMessages
                select new
                {
                    ThreadId = groupedMessages.Key,
                    Count = groupedMessages.Count()
                })
            .ToDictionaryAsync(item => item.ThreadId, item => item.Count);

        var employeeLookup = await LoadEmployeeLookupAsync(
            participants
                .Select(item => item.UserId)
                .Concat(lastMessages.Where(item => item.SenderUserId.HasValue).Select(item => item.SenderUserId!.Value)));
        var participantsByThreadId = participants
            .GroupBy(item => item.ChatThreadId)
            .ToDictionary(group => group.Key, group => group.ToList());
        var lastMessageByThreadId = lastMessages.ToDictionary(item => item.ChatThreadId);

        var viewerParticipants = participants
            .Where(item => item.UserId == currentUserId)
            .ToDictionary(item => item.ChatThreadId);

        return threads
            .Select(thread =>
            {
                var threadParticipants = participantsByThreadId.GetValueOrDefault(thread.Id, []);
                var viewerParticipant = viewerParticipants.GetValueOrDefault(thread.Id);
                var lastMessage = lastMessageByThreadId.GetValueOrDefault(thread.Id);
                var unreadCount = unreadCounts.GetValueOrDefault(thread.Id);

                var participantDtos = threadParticipants
                    .Select(participant =>
                    {
                        var employee = employeeLookup.GetValueOrDefault(participant.UserId);
                        return new ChatParticipantDto(
                            participant.UserId.ToString(),
                            employee?.FullName ?? "Unknown user",
                            RoleCatalog.NormalizeRole(employee?.Role ?? "Employee"),
                            employee?.Department ?? string.Empty,
                            employee?.ProfilePhotoUrl,
                            participant.RoleInThread,
                            participant.UserId == currentUserId);
                    })
                    .OrderByDescending(item => item.IsCurrentUser)
                    .ThenBy(item => item.FullName)
                    .ToList();

                var displayName = thread.ThreadType == "Direct"
                    ? ResolveDirectThreadName(currentUserId, participantDtos)
                    : thread.Name;
                var description = thread.ThreadType == "Direct"
                    ? ResolveDirectThreadDescription(currentUserId, participantDtos)
                    : thread.Description;
                var photoUrl = thread.ThreadType == "Direct"
                    ? ResolveDirectThreadPhotoUrl(currentUserId, participantDtos)
                    : thread.PhotoUrl;

                return new ChatThreadDto(
                    thread.Id.ToString(),
                    thread.ThreadType,
                    displayName,
                    description,
                    thread.ProjectId?.ToString(),
                    thread.DepartmentName,
                    photoUrl,
                    participantDtos.Count,
                    unreadCount,
                    viewerParticipant?.IsPinned ?? false,
                    viewerParticipant?.IsMuted ?? false,
                    lastMessage?.Id.ToString(),
                    lastMessage?.MessageText,
                    lastMessage?.MessageType,
                    ResolveLastMessageSenderName(lastMessage, employeeLookup),
                    lastMessage?.CreatedAtUtc.ToString("O"),
                    participantDtos);
            })
            .OrderByDescending(item => item.LastMessageAtUtc ?? item.Id)
            .ToList();
    }

    private static string ResolveDirectThreadName(Guid currentUserId, IReadOnlyList<ChatParticipantDto> participants)
    {
        return participants.FirstOrDefault(item => item.UserId != currentUserId.ToString())?.FullName ?? "Direct message";
    }

    private static string ResolveDirectThreadDescription(Guid currentUserId, IReadOnlyList<ChatParticipantDto> participants)
    {
        var otherParticipant = participants.FirstOrDefault(item => item.UserId != currentUserId.ToString());
        return otherParticipant is null
            ? "Private conversation"
            : $"{otherParticipant.Role} • {otherParticipant.Department}";
    }

    private static string? ResolveDirectThreadPhotoUrl(Guid currentUserId, IReadOnlyList<ChatParticipantDto> participants)
    {
        return participants.FirstOrDefault(item => item.UserId != currentUserId.ToString())?.ProfilePhotoUrl;
    }

    private static string? ResolveLastMessageSenderName(ChatMessageEntity? message, IReadOnlyDictionary<Guid, EmployeeEntity> employeeLookup)
    {
        if (message is null)
        {
            return null;
        }

        if (!message.SenderUserId.HasValue)
        {
            return "System";
        }

        return employeeLookup.TryGetValue(message.SenderUserId.Value, out var employee)
            ? employee.FullName
            : "Unknown user";
    }

    private static ChatContactDto MapContact(EmployeeEntity employee, string contextLabel)
    {
        return new ChatContactDto(
            employee.Id.ToString(),
            employee.FullName,
            RoleCatalog.FormatRoles(employee.RolesJson, employee.Role),
            employee.Department,
            employee.ProfilePhotoUrl,
            contextLabel);
    }

    private static ChatMessageDto MapMessage(
        ChatMessageEntity message,
        IReadOnlyDictionary<Guid, EmployeeEntity> employeeLookup,
        Guid currentUserId)
    {
        EmployeeEntity? sender = null;
        if (message.SenderUserId.HasValue)
        {
            employeeLookup.TryGetValue(message.SenderUserId.Value, out sender);
        }

        return new ChatMessageDto(
            message.Id.ToString(),
            message.ChatThreadId.ToString(),
            message.SenderUserId?.ToString(),
            sender?.FullName ?? "System",
            sender is null ? "System" : RoleCatalog.FormatRoles(sender.RolesJson, sender.Role),
            sender?.ProfilePhotoUrl,
            message.MessageType,
            message.MessageText,
            message.MessageStatus,
            message.ReplyToMessageId?.ToString(),
            null,
            message.ForwardedFromMessageId?.ToString(),
            message.CreatedAtUtc.ToString("O"),
            message.EditedAtUtc?.ToString("O"),
            message.DeliveredAtUtc?.ToString("O"),
            message.SeenAtUtc?.ToString("O"),
            message.IsPinned,
            message.Attachments.Where(item => !item.IsDeleted).Select(MapAttachment).ToList(),
            message.Reactions
                .GroupBy(item => item.Emoji)
                .Select(group => new ChatReactionSummaryDto(
                    group.Key,
                    group.Count(),
                    group.Any(item => item.UserId == currentUserId)))
                .OrderByDescending(item => item.Count)
                .ToList(),
            ExtractMentions(message.MessageText),
            message.SenderUserId == currentUserId);
    }

    private static ChatAttachmentDto MapAttachment(ChatAttachmentEntity attachment)
    {
        return new ChatAttachmentDto(
            attachment.Id.ToString(),
            attachment.FileName,
            attachment.OriginalFileName,
            attachment.ContentType,
            attachment.FileSizeBytes,
            attachment.PublicUrl,
            attachment.AttachmentType,
            attachment.ScanStatus,
            attachment.PreviewUrl,
            attachment.CreatedAtUtc.ToString("O"));
    }

    private static ChatPresenceDto MapPresence(ChatPresenceEntity presence)
    {
        var effectiveStatus = presence.UpdatedAtUtc < DateTime.UtcNow.AddMinutes(-5)
            ? "Offline"
            : presence.PresenceStatus;

        return new ChatPresenceDto(
            presence.UserId.ToString(),
            effectiveStatus,
            presence.ActiveThreadId?.ToString(),
            effectiveStatus != "Offline" && presence.IsTyping,
            presence.LastSeenAtUtc.ToString("O"));
    }

    private static ChatNotificationPreferencesDto MapNotificationPreferences(ChatNotificationPreferenceEntity preferences)
    {
        return new ChatNotificationPreferencesDto(
            preferences.BrowserNotificationsEnabled,
            preferences.SoundEnabled,
            preferences.EmailNotificationsEnabled,
            preferences.MentionNotificationsEnabled,
            preferences.OfflineNotificationsEnabled);
    }

    private static IReadOnlyList<string> ExtractMentions(string text)
    {
        return text
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(item => item.StartsWith('@') && item.Length > 1)
            .Select(item => item.Trim('@', '.', ',', ':', ';', '!', '?'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList();
    }

    private async Task<IReadOnlyDictionary<Guid, EmployeeEntity>> LoadEmployeeLookupAsync(IEnumerable<Guid> userIds)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, EmployeeEntity>();
        }

        return await dbContext.Employees
            .AsNoTracking()
            .Where(item => ids.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id);
    }

    private static IReadOnlyDictionary<Guid, string> BuildProjectParticipantRoles(ProjectEntity project)
    {
        var roles = new Dictionary<Guid, string>();

        if (project.AdminId != Guid.Empty)
        {
            roles[project.AdminId] = "Owner";
        }

        if (project.ManagerId != Guid.Empty)
        {
            roles[project.ManagerId] = "Admin";
        }

        foreach (var userId in JsonListSerializer.Deserialize(project.TeamMemberIdsJson)
                     .Select(TryParseGuid)
                     .Where(item => item.HasValue)
                     .Select(item => item!.Value))
        {
            if (!roles.ContainsKey(userId))
            {
                roles[userId] = "Member";
            }
        }

        return roles;
    }

    private static IReadOnlyCollection<Guid> ParseParticipantIds(ProjectEntity project)
    {
        var participantIds = new HashSet<Guid>();
        if (project.AdminId != Guid.Empty)
        {
            participantIds.Add(project.AdminId);
        }

        if (project.ManagerId != Guid.Empty)
        {
            participantIds.Add(project.ManagerId);
        }

        foreach (var userId in JsonListSerializer.Deserialize(project.TeamMemberIdsJson)
                     .Select(TryParseGuid)
                     .Where(item => item.HasValue)
                     .Select(item => item!.Value))
        {
            participantIds.Add(userId);
        }

        return participantIds;
    }

    private static bool IsProjectVisibleToUser(ProjectEntity project, Guid currentUserId)
    {
        if (project.ManagerId == currentUserId || project.AdminId == currentUserId)
        {
            return true;
        }

        return JsonListSerializer.Deserialize(project.TeamMemberIdsJson)
            .Select(TryParseGuid)
            .Any(item => item == currentUserId);
    }

    private static string BuildProjectThreadDescription(ProjectEntity project)
    {
        var parts = new[]
        {
            project.Department.Trim(),
            project.DeliveryModel.Trim(),
            project.Status.Trim()
        }.Where(item => !string.IsNullOrWhiteSpace(item));

        return string.Join(" • ", parts);
    }

    private static ChatMessageEntity CreateSystemMessage(Guid threadId, string text, Guid? senderUserId = null)
    {
        return new ChatMessageEntity
        {
            Id = Guid.NewGuid(),
            ChatThreadId = threadId,
            SenderUserId = senderUserId == Guid.Empty ? null : senderUserId,
            MessageType = "System",
            MessageText = text,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    private static Guid? TryParseGuid(string? value)
    {
        return Guid.TryParse(value, out var parsed) ? parsed : null;
    }

    private static string NormalizeMessageType(string? messageType)
    {
        return string.Equals(messageType?.Trim(), "System", StringComparison.OrdinalIgnoreCase)
            ? "System"
            : "Text";
    }

    private static string? NormalizeGroupThreadType(string? threadType)
    {
        var normalized = threadType?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return "TeamGroup";
        }

        return normalized.ToLowerInvariant() switch
        {
            "teamgroup" or "team" => "TeamGroup",
            "rolegroup" or "role" => "RoleGroup",
            "broadcast" => "Broadcast",
            _ => null
        };
    }

    private static string? NormalizeThreadRole(string? role)
    {
        return role?.Trim().ToLowerInvariant() switch
        {
            "owner" => "Owner",
            "admin" => "Admin",
            "member" => "Member",
            _ => null
        };
    }

    private static string NormalizePresenceStatus(string? status)
    {
        return status?.Trim().ToLowerInvariant() switch
        {
            "online" => "Online",
            "away" => "Away",
            "busy" => "Busy",
            "offline" => "Offline",
            _ => "Online"
        };
    }
}
