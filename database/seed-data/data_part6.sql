-- ============================================================================
-- 15. CHAT THREADS (4 threads: 2 project groups, 1 department, 1 direct)
-- ============================================================================
INSERT INTO [dbo].[ChatThreads] ([Id],[ThreadType],[Name],[ProjectId],[DepartmentName],[CreatedByUserId],[CreatedAtUtc],[UpdatedAtUtc],[IsActive],[IsArchived],[PhotoUrl],[Description],[PermissionsJson],[ArchivedByUserId],[ArchivedAtUtc])
VALUES
('CTH00001-0000-0000-0000-000000000001',N'Project',N'TMS-v2 Team','P0000001-0000-0000-0000-000000000001',NULL,(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),DATEADD(DAY,-60,GETUTCDATE()),GETUTCDATE(),1,0,NULL,N'Timesheet Management System v2 project discussion',N'{"canAddMembers":"Admin","canRemoveMembers":"Admin"}',NULL,NULL),
('CTH00001-0000-0000-0000-000000000002',N'Project',N'Acme Portal Dev','P0000001-0000-0000-0000-000000000002',NULL,(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),DATEADD(DAY,-40,GETUTCDATE()),GETUTCDATE(),1,0,NULL,N'Acme Corp client portal development',N'{"canAddMembers":"Admin"}',NULL,NULL),
('CTH00001-0000-0000-0000-000000000003',N'Department',N'Engineering Team',NULL,N'Engineering',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),DATEADD(DAY,-90,GETUTCDATE()),GETUTCDATE(),1,0,NULL,N'Engineering department announcements and discussions',N'{}',NULL,NULL),
('CTH00001-0000-0000-0000-000000000004',N'Direct',N'Vikram-Neha',NULL,NULL,(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),DATEADD(DAY,-45,GETUTCDATE()),GETUTCDATE(),1,0,NULL,NULL,N'{}',NULL,NULL);
GO

-- ============================================================================
-- 16. CHAT PARTICIPANTS (12 participants across 4 threads)
-- ============================================================================
INSERT INTO [dbo].[ChatParticipants] ([Id],[ChatThreadId],[UserId],[RoleInThread],[JoinedAtUtc],[IsMuted],[IsPinned],[LastSeenMessageId],[LastSeenAtUtc],[IsActive])
VALUES
('CP000001-0000-0000-0000-000000000001','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Admin',DATEADD(DAY,-60,GETUTCDATE()),0,1,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000002','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'Member',DATEADD(DAY,-60,GETUTCDATE()),0,0,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000003','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'Member',DATEADD(DAY,-60,GETUTCDATE()),0,0,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000004','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0007'),N'Member',DATEADD(DAY,-55,GETUTCDATE()),0,0,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000005','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0021'),N'Member',DATEADD(DAY,-55,GETUTCDATE()),1,0,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000006','CTH00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'Admin',DATEADD(DAY,-40,GETUTCDATE()),0,1,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000007','CTH00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'Member',DATEADD(DAY,-40,GETUTCDATE()),0,0,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000008','CTH00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0025'),N'Member',DATEADD(DAY,-38,GETUTCDATE()),0,0,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000009','CTH00001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Admin',DATEADD(DAY,-90,GETUTCDATE()),0,1,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000010','CTH00001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),N'Member',DATEADD(DAY,-90,GETUTCDATE()),0,0,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000011','CTH00001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),N'Member',DATEADD(DAY,-45,GETUTCDATE()),0,1,NULL,GETUTCDATE(),1),
('CP000001-0000-0000-0000-000000000012','CTH00001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Member',DATEADD(DAY,-45,GETUTCDATE()),0,1,NULL,GETUTCDATE(),1);
GO

-- ============================================================================
-- 17. CHAT MESSAGES (12 messages)
-- ============================================================================
INSERT INTO [dbo].[ChatMessages] ([Id],[ChatThreadId],[SenderUserId],[MessageType],[MessageText],[MessageStatus],[ReplyToMessageId],[ForwardedFromMessageId],[CreatedAtUtc],[EditedAtUtc],[DeliveredAtUtc],[SeenAtUtc],[IsPinned],[PinnedByUserId],[PinnedAtUtc],[DeletedAtUtc],[DeletedByUserId],[IsDeleted])
VALUES
('CM000001-0000-0000-0000-000000000001','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Text',N'Hi team! Let''s start the TMS v2 project discussion here. I''ve uploaded the initial requirements document.',N'Sent',NULL,NULL,DATEADD(DAY,-58,GETUTCDATE()),NULL,DATEADD(DAY,-58,GETUTCDATE()),DATEADD(DAY,-58,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000002','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'Text',N'Great Neha! I will start working on the timesheet submission UI this week.',N'Sent',NULL,NULL,DATEADD(DAY,-57,GETUTCDATE()),NULL,DATEADD(DAY,-57,GETUTCDATE()),DATEADD(DAY,-57,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000003','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'Text',N'I can start on the approval workflow API once the schema is ready. Neha, when can we expect the DB schema?',N'Sent',NULL,NULL,DATEADD(DAY,-56,GETUTCDATE()),NULL,DATEADD(DAY,-56,GETUTCDATE()),DATEADD(DAY,-56,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000004','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Text',N'I''ll have the ERD ready by tomorrow EOD. Will share for review.',N'Sent','CM000001-0000-0000-0000-000000000003',NULL,DATEADD(DAY,-56,GETUTCDATE()),NULL,DATEADD(DAY,-56,GETUTCDATE()),DATEADD(DAY,-56,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000005','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0007'),N'Text',N'CI/CD pipeline setup is done on Azure DevOps. Build, test, and deploy stages configured.',N'Sent',NULL,NULL,DATEADD(DAY,-50,GETUTCDATE()),NULL,DATEADD(DAY,-50,GETUTCDATE()),DATEADD(DAY,-50,GETUTCDATE()),1,(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),DATEADD(DAY,-50,GETUTCDATE()),NULL,NULL,0),
('CM000001-0000-0000-0000-000000000006','CTH00001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0021'),N'Text',N'I''ve submitted the dashboard wireframes. Please review when you get a chance.',N'Sent',NULL,NULL,DATEADD(DAY,-35,GETUTCDATE()),DATEADD(DAY,-34,GETUTCDATE()),DATEADD(DAY,-35,GETUTCDATE()),DATEADD(DAY,-35,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000007','CTH00001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0001'),N'Text',N'Team, please ensure all timesheets for last week are submitted by Wednesday EOD.',N'Sent',NULL,NULL,DATEADD(DAY,-3,GETUTCDATE()),NULL,DATEADD(DAY,-3,GETUTCDATE()),DATEADD(DAY,-3,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000008','CTH00001-0000-0000-0000-000000000003',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),N'Text',N'Noted, Rajesh. I will ensure my team submits on time.',N'Sent','CM000001-0000-0000-0000-000000000007',NULL,DATEADD(DAY,-3,GETUTCDATE()),NULL,DATEADD(DAY,-3,GETUTCDATE()),DATEADD(DAY,-3,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000009','CTH00001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0003'),N'Text',N'Neha, the approval flow API — can we get an update on the ETA?',N'Sent',NULL,NULL,DATEADD(DAY,-4,GETUTCDATE()),NULL,DATEADD(DAY,-4,GETUTCDATE()),DATEADD(DAY,-4,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000010','CTH00001-0000-0000-0000-000000000004',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'Text',N'Hi Vikram, should be done by end of this week. Pending integration tests only.',N'Sent','CM000001-0000-0000-0000-000000000009',NULL,DATEADD(DAY,-4,GETUTCDATE()),NULL,DATEADD(DAY,-4,GETUTCDATE()),DATEADD(DAY,-4,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000011','CTH00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'Text',N'Acme auth module is complete. Moving on to milestone tracking integration.',N'Sent',NULL,NULL,DATEADD(DAY,-12,GETUTCDATE()),NULL,DATEADD(DAY,-12,GETUTCDATE()),DATEADD(DAY,-12,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0),
('CM000001-0000-0000-0000-000000000012','CTH00001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'Text',N'Great, Arjun! I have the milestone CRUD ready. Let''s sync tomorrow morning to integrate.',N'Sent','CM000001-0000-0000-0000-000000000011',NULL,DATEADD(DAY,-12,GETUTCDATE()),NULL,DATEADD(DAY,-12,GETUTCDATE()),DATEADD(DAY,-11,GETUTCDATE()),0,NULL,NULL,NULL,NULL,0);
GO

-- ============================================================================
-- 18. CHAT ATTACHMENTS (3 files)
-- ============================================================================
INSERT INTO [dbo].[ChatAttachments] ([Id],[ChatMessageId],[UploadedByUserId],[FileName],[OriginalFileName],[ContentType],[FileSizeBytes],[StoragePath],[PublicUrl],[AttachmentType],[ScanStatus],[PreviewUrl],[CreatedAtUtc],[IsDeleted],[DeletedAtUtc])
VALUES
('CA000001-0000-0000-0000-000000000001','CM000001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'tms-v2-requirements.pdf',N'TMS_v2_Requirements_Document.pdf',N'application/pdf',2456789,N'/uploads/chat/tms-v2-requirements.pdf',N'https://storage.arkia.com/chat/tms-v2-requirements.pdf',N'Document',N'Clean',NULL,DATEADD(DAY,-58,GETUTCDATE()),0,NULL),
('CA000001-0000-0000-0000-000000000002','CM000001-0000-0000-0000-000000000006',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0021'),N'dashboard-wireframes.fig',N'Dashboard_Wireframes_v2.fig',N'application/octet-stream',5678901,N'/uploads/chat/dashboard-wireframes.fig',N'https://storage.arkia.com/chat/dashboard-wireframes.fig',N'Design File',N'Clean',NULL,DATEADD(DAY,-35,GETUTCDATE()),0,NULL),
('CA000001-0000-0000-0000-000000000003','CM000001-0000-0000-0000-000000000001',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'sprint-planning.xlsx',N'Sprint_1_Planning.xlsx',N'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',123456,N'/uploads/chat/sprint-planning.xlsx',N'https://storage.arkia.com/chat/sprint-planning.xlsx',N'Spreadsheet',N'Clean',NULL,DATEADD(DAY,-58,GETUTCDATE()),0,NULL);
GO

-- ============================================================================
-- 19. CHAT REACTIONS (4 reactions)
-- ============================================================================
INSERT INTO [dbo].[ChatReactions] ([Id],[ChatMessageId],[UserId],[Emoji],[CreatedAtUtc])
VALUES
('CR000001-0000-0000-0000-000000000001','CM000001-0000-0000-0000-000000000002',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'👍',DATEADD(DAY,-57,GETUTCDATE())),
('CR000001-0000-0000-0000-000000000002','CM000001-0000-0000-0000-000000000005',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0004'),N'🎉',DATEADD(DAY,-50,GETUTCDATE())),
('CR000001-0000-0000-0000-000000000003','CM000001-0000-0000-0000-000000000005',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0005'),N'🚀',DATEADD(DAY,-50,GETUTCDATE())),
('CR000001-0000-0000-0000-000000000004','CM000001-0000-0000-0000-000000000011',(SELECT Id FROM [dbo].[Employees] WHERE EmployeeCode=N'EMP-0006'),N'✅',DATEADD(DAY,-12,GETUTCDATE()));
GO

-- ============================================================================
-- 20. CHAT PRESENCES (8 online users)
-- ============================================================================
INSERT INTO [dbo].[ChatPresences] ([UserId],[PresenceStatus],[ActiveThreadId],[IsTyping],[LastSeenAtUtc],[UpdatedAtUtc])
SELECT Id, N'Online', NULL, 0, GETUTCDATE(), GETUTCDATE() FROM [dbo].[Employees] WHERE EmployeeCode IN (N'EMP-0001',N'EMP-0003',N'EMP-0004',N'EMP-0005',N'EMP-0006',N'EMP-0007',N'EMP-0021',N'EMP-0023');
GO

-- ============================================================================
-- 21. CHAT NOTIFICATION PREFERENCES (10 users)
-- ============================================================================
INSERT INTO [dbo].[ChatNotificationPreferences] ([UserId],[BrowserNotificationsEnabled],[SoundEnabled],[EmailNotificationsEnabled],[MentionNotificationsEnabled],[OfflineNotificationsEnabled],[UpdatedAtUtc])
SELECT Id, 1, 1, 1, 1, 0, GETUTCDATE() FROM [dbo].[Employees] WHERE EmployeeCode IN (N'EMP-0001',N'EMP-0003',N'EMP-0004',N'EMP-0005',N'EMP-0006',N'EMP-0007',N'EMP-0008',N'EMP-0011',N'EMP-0015',N'EMP-0021');
GO
