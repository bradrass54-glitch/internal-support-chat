CREATE TABLE `workspaceMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','agent','user') NOT NULL DEFAULT 'user',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaceMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(63) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` int NOT NULL,
	`logo` varchar(500),
	`customDomain` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `departments` DROP INDEX `departments_name_unique`;--> statement-breakpoint
ALTER TABLE `conversations` ADD `workspaceId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `workspaceId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `escalationTickets` ADD `workspaceId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledgeBaseDocuments` ADD `workspaceId` int NOT NULL;