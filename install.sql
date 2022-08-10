CREATE DATABASE uploader;

USE uploader;

CREATE TABLE `downloads` (
  `id` int NOT NULL,
  `user` text NOT NULL,
  `url` text NOT NULL,
  `amount` int NOT NULL,
  `name` text NOT NULL,
  `password` text,
  PRIMARY KEY (`id`)
);