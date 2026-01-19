CREATE TABLE `escalationRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`departmentId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`triggerType` enum('time_elapsed','keyword_match','user_request','ai_confidence') NOT NULL,
	`triggerValue` varchar(500),
	`assignToDepartment` int,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `escalationRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `workspaceDeptIdx` ON `escalationRules` (`workspaceId`,`departmentId`);