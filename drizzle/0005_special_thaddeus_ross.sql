CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('owner','admin','agent','user') NOT NULL DEFAULT 'user',
	`token` varchar(255) NOT NULL,
	`status` enum('pending','accepted','cancelled','expired') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_token_unique` UNIQUE(`token`)
);
