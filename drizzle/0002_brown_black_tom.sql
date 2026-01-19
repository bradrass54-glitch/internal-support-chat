CREATE TABLE `knowledgeBaseChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`embedding` varchar(4000),
	`tokens` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledgeBaseChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeBaseDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`fileKey` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`extractedText` text,
	`status` enum('uploading','processing','ready','failed','archived') NOT NULL DEFAULT 'uploading',
	`uploadedBy` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`isPublic` boolean NOT NULL DEFAULT true,
	`tags` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	CONSTRAINT `knowledgeBaseDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `kbChunkDocIdx` ON `knowledgeBaseChunks` (`documentId`);--> statement-breakpoint
CREATE INDEX `kbDeptIdx` ON `knowledgeBaseDocuments` (`departmentId`);--> statement-breakpoint
CREATE INDEX `kbStatusIdx` ON `knowledgeBaseDocuments` (`status`);--> statement-breakpoint
CREATE INDEX `kbUploadedByIdx` ON `knowledgeBaseDocuments` (`uploadedBy`);