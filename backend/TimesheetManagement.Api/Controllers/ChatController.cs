using AbhiTimesheet.Api.Contracts.Chat;
using AbhiTimesheet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AbhiTimesheet.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
// cspell:ignore unpin unmute yyyyMMddHHmmssfff wwwroot
public sealed class ChatController(ChatService chatService, IWebHostEnvironment environment) : ControllerBase
{
    private const long MaxAttachmentSizeBytes = 25 * 1024 * 1024;
    // cspell:disable
    private static readonly HashSet<string> AllowedAttachmentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
    // cspell:enable

    [HttpGet("threads")]
    public async Task<ActionResult<IReadOnlyList<ChatThreadDto>>> GetThreads()
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        await chatService.EnsureFoundationsAsync();
        return Ok(await chatService.GetThreadsAsync(currentUserId));
    }

    [HttpGet("threads/{threadId:guid}")]
    public async Task<ActionResult<ChatThreadDto>> GetThread(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var thread = await chatService.GetThreadAsync(threadId, currentUserId);
        return thread is null ? NotFound(new { message = "Chat thread not found." }) : Ok(thread);
    }

    [HttpGet("threads/{threadId:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<ChatMessageDto>>> GetMessages(Guid threadId, [FromQuery] int take = 60)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var messages = await chatService.GetMessagesAsync(threadId, currentUserId, take);
        return Ok(messages);
    }

    [HttpGet("contacts")]
    public async Task<ActionResult<ChatContactDirectoryDto>> GetContacts()
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        await chatService.EnsureFoundationsAsync();
        return Ok(await chatService.GetContactsAsync(currentUserId));
    }

    [HttpPost("threads/direct")]
    public async Task<ActionResult<ChatThreadDto>> CreateDirectThread([FromBody] CreateDirectChatRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        if (!Guid.TryParse(request.UserId, out var otherUserId))
        {
            return BadRequest(new { message = "Select a valid employee to start chatting." });
        }

        var thread = await chatService.EnsureDirectThreadAsync(currentUserId, otherUserId);
        return thread is null
            ? BadRequest(new { message = "Unable to create a direct chat with the selected employee." })
            : Ok(thread);
    }

    [HttpPost("threads/group")]
    public async Task<ActionResult<ChatThreadDto>> CreateGroupThread([FromBody] CreateChatGroupRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var thread = await chatService.CreateGroupThreadAsync(currentUserId, request);
        return thread is null
            ? BadRequest(new { message = "Unable to create the chat group." })
            : Ok(thread);
    }

    [HttpPost("messages/send")]
    public async Task<ActionResult<ChatMessageDto>> SendMessage([FromBody] SendChatMessageRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var message = await chatService.SendMessageAsync(currentUserId, request);
        return message is null
            ? BadRequest(new { message = "Unable to send the message." })
            : Ok(message);
    }

    [HttpPut("messages/{messageId:guid}")]
    public async Task<ActionResult<ChatMessageDto>> UpdateMessage(Guid messageId, [FromBody] UpdateChatMessageRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var message = await chatService.UpdateMessageAsync(currentUserId, messageId, request);
        return message is null ? BadRequest(new { message = "Unable to edit this message." }) : Ok(message);
    }

    [HttpDelete("messages/{messageId:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid messageId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.DeleteMessageForEveryoneAsync(currentUserId, messageId)
            ? NoContent()
            : BadRequest(new { message = "Unable to delete this message." });
    }

    [HttpPost("messages/{messageId:guid}/reactions")]
    public async Task<ActionResult<ChatMessageDto>> ToggleReaction(Guid messageId, [FromBody] ChatReactionRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var message = await chatService.ToggleReactionAsync(currentUserId, messageId, request);
        return message is null ? BadRequest(new { message = "Unable to update reaction." }) : Ok(message);
    }

    [HttpPost("messages/{messageId:guid}/pin")]
    public async Task<IActionResult> PinMessage(Guid messageId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.ToggleMessagePinAsync(currentUserId, messageId, true) ? NoContent() : BadRequest(new { message = "Unable to pin this message." });
    }

    [HttpDelete("messages/{messageId:guid}/pin")]
    public async Task<IActionResult> UnpinMessage(Guid messageId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.ToggleMessagePinAsync(currentUserId, messageId, false) ? NoContent() : BadRequest(new { message = "Unable to unpin this message." });
    }

    [HttpPost("attachments")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ChatAttachmentDto>> UploadAttachment(IFormFile? file)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Choose a file to upload." });
        }

        if (file.Length > MaxAttachmentSizeBytes)
        {
            return BadRequest(new { message = "Attachments must be 25 MB or smaller." });
        }

        if (!AllowedAttachmentTypes.Contains(file.ContentType ?? string.Empty))
        {
            return BadRequest(new { message = "This file type is not allowed for chat attachments." });
        }

        var uploadsRoot = EnsureChatUploadsRoot();
        var extension = Path.GetExtension(file.FileName);
        var safeExtension = string.IsNullOrWhiteSpace(extension) ? ".bin" : extension;
        var fileName = $"{currentUserId:N}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{safeExtension}";
        var absolutePath = Path.Combine(uploadsRoot, fileName);
        await using (var stream = System.IO.File.Create(absolutePath))
        {
            await file.CopyToAsync(stream);
        }

        var publicUrl = $"/uploads/chat/{fileName}";
        var attachment = await chatService.RegisterAttachmentAsync(
            currentUserId,
            fileName,
            Path.GetFileName(file.FileName),
            file.ContentType ?? "application/octet-stream",
            file.Length,
            absolutePath,
            publicUrl);

        return attachment is null ? BadRequest(new { message = "Unable to register attachment." }) : Ok(attachment);
    }

    [HttpPost("threads/{threadId:guid}/read")]
    public async Task<IActionResult> MarkThreadRead(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var updated = await chatService.MarkThreadAsSeenAsync(threadId, currentUserId);
        return updated ? NoContent() : NotFound(new { message = "Chat thread not found." });
    }

    [HttpPut("threads/{threadId:guid}")]
    public async Task<ActionResult<ChatThreadDto>> UpdateThread(Guid threadId, [FromBody] UpdateThreadRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        var thread = await chatService.UpdateThreadAsync(currentUserId, threadId, request);
        return thread is null ? BadRequest(new { message = "Unable to update this chat." }) : Ok(thread);
    }

    [HttpPost("threads/{threadId:guid}/pin")]
    public async Task<IActionResult> PinThread(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.UpdateThreadPreferenceAsync(currentUserId, threadId, pinned: true, muted: null) ? NoContent() : NotFound(new { message = "Chat thread not found." });
    }

    [HttpDelete("threads/{threadId:guid}/pin")]
    public async Task<IActionResult> UnpinThread(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.UpdateThreadPreferenceAsync(currentUserId, threadId, pinned: false, muted: null) ? NoContent() : NotFound(new { message = "Chat thread not found." });
    }

    [HttpPost("threads/{threadId:guid}/mute")]
    public async Task<IActionResult> MuteThread(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.UpdateThreadPreferenceAsync(currentUserId, threadId, pinned: null, muted: true) ? NoContent() : NotFound(new { message = "Chat thread not found." });
    }

    [HttpDelete("threads/{threadId:guid}/mute")]
    public async Task<IActionResult> UnmuteThread(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.UpdateThreadPreferenceAsync(currentUserId, threadId, pinned: null, muted: false) ? NoContent() : NotFound(new { message = "Chat thread not found." });
    }

    [HttpPost("threads/{threadId:guid}/archive")]
    public async Task<IActionResult> ArchiveThread(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.ArchiveThreadAsync(currentUserId, threadId) ? NoContent() : BadRequest(new { message = "Unable to archive this chat." });
    }

    [HttpPost("threads/{threadId:guid}/leave")]
    public async Task<IActionResult> LeaveThread(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.LeaveThreadAsync(currentUserId, threadId) ? NoContent() : BadRequest(new { message = "Unable to leave this chat." });
    }

    [HttpDelete("threads/{threadId:guid}/participants/{userId:guid}")]
    public async Task<IActionResult> RemoveParticipant(Guid threadId, Guid userId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.RemoveParticipantAsync(currentUserId, threadId, userId) ? NoContent() : BadRequest(new { message = "Unable to remove participant." });
    }

    [HttpPut("threads/{threadId:guid}/participants/role")]
    public async Task<IActionResult> UpdateParticipantRole(Guid threadId, [FromBody] UpdateThreadParticipantRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return await chatService.UpdateParticipantRoleAsync(currentUserId, threadId, request) ? NoContent() : BadRequest(new { message = "Unable to update participant role." });
    }

    [HttpPost("presence")]
    public async Task<ActionResult<ChatPresenceDto>> UpdatePresence([FromBody] UpdatePresenceRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return Ok(await chatService.UpdatePresenceAsync(currentUserId, request));
    }

    [HttpGet("threads/{threadId:guid}/presence")]
    public async Task<ActionResult<IReadOnlyList<ChatPresenceDto>>> GetPresence(Guid threadId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return Ok(await chatService.GetThreadPresenceAsync(currentUserId, threadId));
    }

    [HttpGet("notifications/preferences")]
    public async Task<ActionResult<ChatNotificationPreferencesDto>> GetNotificationPreferences()
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return Ok(await chatService.GetNotificationPreferencesAsync(currentUserId));
    }

    [HttpPut("notifications/preferences")]
    public async Task<ActionResult<ChatNotificationPreferencesDto>> UpdateNotificationPreferences([FromBody] ChatNotificationPreferencesDto request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Your session could not be verified. Please sign in again." });
        }

        return Ok(await chatService.UpdateNotificationPreferencesAsync(currentUserId, request));
    }

    private string EnsureChatUploadsRoot()
    {
        var webRoot = environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(environment.ContentRootPath, "wwwroot");
        }

        var uploadsRoot = Path.Combine(webRoot, "uploads", "chat");
        Directory.CreateDirectory(uploadsRoot);
        return uploadsRoot;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        return Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }
}
