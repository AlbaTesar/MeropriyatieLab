// файл ./config/index.js
const fs = require('fs');

const config = {
	db: {
    mysql : {
      host: 'localhost', // Или IP-адрес вашего сервера MySQL
      port: 3306, // порт базы данных
      user: 'root', // Имя пользователя MySQL
      password: 'root', // Пароль пользователя MySQL
      database: 'new_schema', // Имя вашей базы данных
			ssl: {
        rejectUnauthorized: false // Игнорировать самоподписанные сертификаты
			}
    },
  }, 
  port: 3000, // порт на котором будет запущен сервер приложения
  jwtSecret: 'meyson'
};

module.exports =  config;
