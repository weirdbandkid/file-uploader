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

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);


