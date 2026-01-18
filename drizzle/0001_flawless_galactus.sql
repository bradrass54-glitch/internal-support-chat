CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patternId` int NOT NULL,
	`departmentId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`resourceType` varchar(100),
	`resourceId` int,
	`changes` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`departmentId` int NOT NULL,
	`title` varchar(255),
	`status` enum('open','escalated','closed','pending') NOT NULL DEFAULT 'open',
	`escalatedTo` int,
	`escalationReason` text,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`closedAt` timestamp,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `documentationSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`url` varchar(2048),
	`category` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentationSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `escalationTickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`assignedTo` int NOT NULL,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`reason` text NOT NULL,
	`status` enum('pending','in_progress','resolved','closed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `escalationTickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learningInteractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`feedback` enum('helpful','not_helpful','partially_helpful'),
	`rating` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learningInteractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderId` int NOT NULL,
	`senderType` enum('user','agent','system') NOT NULL DEFAULT 'user',
	`content` text NOT NULL,
	`contentHash` varchar(64),
	`isAIGenerated` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`patternHash` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`occurrenceCount` int NOT NULL DEFAULT 1,
	`suggestedSolution` text,
	`confidence` decimal(3,2),
	`lastOccurrence` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patterns_id` PRIMARY KEY(`id`),
	CONSTRAINT `patterns_patternHash_unique` UNIQUE(`patternHash`)
);
--> statement-breakpoint
CREATE TABLE `userDepartments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`departmentId` int NOT NULL,
	`role` enum('user','agent','manager') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userDepartments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `deptIdx` ON `alerts` (`departmentId`);--> statement-breakpoint
CREATE INDEX `activeIdx` ON `alerts` (`isActive`);--> statement-breakpoint
CREATE INDEX `userIdx` ON `auditLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `actionIdx` ON `auditLogs` (`action`);--> statement-breakpoint
CREATE INDEX `createdIdx` ON `auditLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `userIdx` ON `conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `deptIdx` ON `conversations` (`departmentId`);--> statement-breakpoint
CREATE INDEX `statusIdx` ON `conversations` (`status`);--> statement-breakpoint
CREATE INDEX `deptIdx` ON `documentationSources` (`departmentId`);--> statement-breakpoint
CREATE INDEX `categoryIdx` ON `documentationSources` (`category`);--> statement-breakpoint
CREATE INDEX `convIdx` ON `escalationTickets` (`conversationId`);--> statement-breakpoint
CREATE INDEX `agentIdx` ON `escalationTickets` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `statusIdx` ON `escalationTickets` (`status`);--> statement-breakpoint
CREATE INDEX `msgIdx` ON `learningInteractions` (`messageId`);--> statement-breakpoint
CREATE INDEX `userIdx` ON `learningInteractions` (`userId`);--> statement-breakpoint
CREATE INDEX `convIdx` ON `messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `senderIdx` ON `messages` (`senderId`);--> statement-breakpoint
CREATE INDEX `createdIdx` ON `messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `deptIdx` ON `patterns` (`departmentId`);--> statement-breakpoint
CREATE INDEX `hashIdx` ON `patterns` (`patternHash`);--> statement-breakpoint
CREATE INDEX `userDeptIdx` ON `userDepartments` (`userId`,`departmentId`);