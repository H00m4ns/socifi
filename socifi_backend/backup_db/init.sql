-- Create a database for the socifi app and use it
CREATE DATABASE IF NOT EXISTS `day3-sui` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `day3-sui`;

-- User = akun gabungan dengan wallet (address unik) + display_name
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `wallet_address` VARCHAR(66) NOT NULL UNIQUE, -- 0x... (Sui bech32/hex; simpan hex 0x...)
  `display_name` VARCHAR(80) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `posts` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `image_url` TEXT NOT NULL,
  `caption` VARCHAR(280),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `likes` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `post_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  UNIQUE KEY `uniq_like` (`post_id`, `user_id`),
  CONSTRAINT `fk_likes_post` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`),
  CONSTRAINT `fk_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comments` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `post_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `content` VARCHAR(500) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  CONSTRAINT `fk_comments_post` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`),
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jejak reward agar 1x saja per aksi per post
-- action_type: 'post' | 'like' | 'comment'
CREATE TABLE IF NOT EXISTS `reward_claims` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `post_id` BIGINT,
  `user_id` BIGINT NOT NULL,
  `action_type` ENUM('post','like','comment') NOT NULL,
  `tx_digest` VARCHAR(120), -- hasil transfer SUI
  `amount_mist` BIGINT NOT NULL, -- 0.005 SUI = 5_000_000 MIST (1 SUI = 1e9 MIST)
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  UNIQUE KEY `uniq_claim` (`post_id`, `user_id`, `action_type`),
  CONSTRAINT `fk_reward_post` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`),
  CONSTRAINT `fk_reward_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Prevent deleting or updating likes/comments to make them immutable (no unlike, no edit/delete comment)
DELIMITER $$
CREATE TRIGGER `trg_likes_no_delete` BEFORE DELETE ON `likes`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Likes cannot be deleted';
END$$

CREATE TRIGGER `trg_likes_no_update` BEFORE UPDATE ON `likes`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Likes cannot be updated';
END$$

CREATE TRIGGER `trg_comments_no_delete` BEFORE DELETE ON `comments`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Comments cannot be deleted';
END$$

CREATE TRIGGER `trg_comments_no_update` BEFORE UPDATE ON `comments`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Comments cannot be updated';
END$$

DELIMITER ;

