const express = require('express');
const mysql = require('mysql');
const config = require('./config');
const cors = require('cors');
const path = require('path');
const app = express();

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

app.use(express.json());
app.use(cors());

// Указываем, где находятся статические файлы
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Конфигурация подключения к базе данных
const dbConnection = mysql.createConnection(config.db.mysql);

// Подключение к базе данных
dbConnection.connect((err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных: ' + err.stack);
    return;
  }
  console.log('Подключение к базе данных успешно установлено');
});

// Настройка nodemailer для отправки писем
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: 'nodemailer1@yandex.ru',
    pass: 'zfrrctqnydcgkkta' // пароль
  }
});

// CRUD операции для папок и задач

app.use(express.static(path.join(__dirname, 'frontend')));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});


//Получение списка мероприятий:
app.get('/events', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        res.status(401).send('Токен отсутствует');
        return;
    }

    try {
        jwt.verify(token, config.jwtSecret); // Проверяем токен
        dbConnection.query('SELECT id, name, description, date FROM events', (err, results) => {
            if (err) {
                console.error('Ошибка получения списка мероприятий:', err);
                res.status(500).send('Ошибка сервера');
            } else {
                res.json(results);
            }
        });
    } catch (error) {
        console.error('Ошибка токена:', error);
        res.status(401).send('Неверный токен');
    }
});





//Подача заявки:
app.post('/applications', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const { name, eventId } = req.body;

    if (!token || !name || !eventId) {
        res.status(400).send('Все поля обязательны');
        return;
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        const userId = decoded.userId;

        if (!userId) {
            res.status(401).send('Пользователь не аутентифицирован');
            return;
        }

        // Получение информации о мероприятии
        dbConnection.query('SELECT name, date FROM events WHERE id = ?', [eventId], (err, eventResults) => {
            if (err || eventResults.length === 0) {
                console.error('Ошибка получения мероприятия:', err);
                res.status(500).send('Ошибка сервера');
                return;
            }

            const event = eventResults[0];

            // Вставка заявки в базу данных
            dbConnection.query(
                'INSERT INTO applications (user_id, applicant_name, event_id, status) VALUES (?, ?, ?, "new")',
                [userId, name, eventId],
                (err) => {
                    if (err) {
                        console.error('Ошибка подачи заявки:', err);
                        res.status(500).send('Ошибка сервера');
                        return;
                    }

                    // Отправка письма организатору
                    const mailOptions = {
                        from: 'nodemailer1@yandex.ru',
                        to: 'gtesar287@yandex.ru', 
                        subject: `Новая заявка на мероприятие: ${event.name}`,
                        html: `
                            <p>Имя заявителя: ${name}</p>
                            <p>Дата мероприятия: ${event.date}</p>
                            <p>Время подачи заявки: ${new Date().toLocaleString()}</p>
                        `
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error('Ошибка отправки письма:', error);
                            res.status(500).send('Заявка подана, но письмо не отправлено');
                        } else {
                            console.log('Письмо отправлено организатору:', info.response);
                            res.status(201).send('Заявка успешно подана и отправлена организатору');
                        }
                    });
                }
            );
        });
    } catch (error) {
        console.error('Ошибка при обработке токена:', error);
        res.status(401).send('Неверный токен');
    }
});


//Просмотр описания
app.get('/events', (req, res) => {
  dbConnection.query('SELECT id, name, description, date FROM events', (err, results) => {
    if (err) {
      console.error('Ошибка получения списка мероприятий:', err);
      res.status(500).send('Ошибка сервера');
    } else {
      res.json(results);
    }
  });
});



//Просмотр заявок (для организатора):
app.get('/applications', (req, res) => {
    dbConnection.query(
        `SELECT 
            applications.id, 
            users.username AS applicant_name, 
            users.email AS applicant_email, 
            events.name AS event_name, 
            applications.status 
         FROM applications 
         JOIN users ON applications.user_id = users.id 
         JOIN events ON applications.event_id = events.id`,
        (err, results) => {
            if (err) {
                console.error('Ошибка получения заявок:', err);
                res.status(500).send('Ошибка сервера');
            } else {
                res.json(results);
            }
        }
    );
});




//Редактирование статуса заявки:
app.put('/applications/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    dbConnection.query(
        'UPDATE applications SET status = ? WHERE id = ?',
        [status, id],
        (err) => {
            if (err) {
                console.error('Ошибка обновления статуса заявки:', err);
                res.status(500).send('Ошибка сервера');
            } else {
                res.send('Статус заявки обновлен');
            }
        }
    );
});



// Удаление аккаунта
app.delete('/deleteAccount', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).send('Отсутствует токен');
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const username = decoded.username;

    // Найти пользователя по имени
    dbConnection.query('SELECT id FROM users WHERE username = ?', [username], (err, results) => {
      if (err) {
        console.error('Ошибка выполнения запроса SELECT:', err);
        res.status(500).send('Ошибка сервера');
        return;
      }

      if (results.length === 0) {
        res.status(404).send('Пользователь не найден');
        return;
      }

      const userId = results[0].id;

      // Удалить связанные заявки пользователя
      dbConnection.query('DELETE FROM applications WHERE user_id = ?', [userId], (err) => {
        if (err) {
          console.error('Ошибка удаления заявок:', err);
          res.status(500).send('Ошибка сервера');
          return;
        }

        // Удалить самого пользователя
        dbConnection.query('DELETE FROM users WHERE id = ?', [userId], (err) => {
          if (err) {
            console.error('Ошибка удаления пользователя:', err);
            res.status(500).send('Ошибка сервера');
            return;
          }

          res.status(200).send('Аккаунт успешно удалён');
        });
      });
    });
  } catch (error) {
    console.error('Ошибка при проверке токена:', error);
    res.status(401).send('Неверный токен');
  }
});


// Регистрация пользователя
app.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Проверка на существующий email
    dbConnection.query(
      `SELECT * FROM users WHERE email = ?`,
      [email],
      async (err, results) => {
        if (err) {
          console.error('Ошибка выполнения запроса: ' + err.stack);
          res.status(500).send('Ошибка сервера');
          return;
        }
        if (results.length > 0) {
          res.status(409).send('Пользователь с таким email уже существует');
          return;
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Сохранение пользователя в базе данных
        dbConnection.query(
          `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
          [username, hashedPassword, email],
          async (err, result) => {
            if (err) {
              console.error('Ошибка выполнения запроса: ' + err.stack);
              res.status(500).send('Ошибка сервера');
              return;
            }

            const userId = result.insertId;

            // Генерация токена подтверждения почты, который живет 1 день
            const emailConfirmToken = jwt.sign({ userId, email }, config.jwtSecret, { expiresIn: '1d' });

            // Сохранение кода подтверждения в таблице email_confirmation
            dbConnection.query(
              `INSERT INTO email_confirmation (userId, emailConfirmToken) VALUES (?, ?)`,
              [userId, emailConfirmToken],
              (err, result) => {
                if (err) {
                  console.error('Ошибка сохранения кода подтверждения: ' + err.stack);
                  res.status(500).send('Ошибка сервера');
                  return;
                }

                console.log('Код подтверждения успешно создан');

                // Отправка письма с подтверждением почты
                const mailOptions = {
                  from: 'nodemailer1@yandex.ru',
                  to: email,
                  subject: 'Подтверждение рег',
                  html: `<p>Для подтверждения регистрации перейдите по ссылке: <a href="http://localhost:3000/confirm/${emailConfirmToken}">Подтвердить регистрацию</a></p>`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.error('Ошибка при отправке письма:', error);
                    res.status(500).send('Ошибка сервера');
                  } else {
                    console.log('Письмо с подтверждением отправлено:', info.response);
                    res.status(201).send('Пользователь успешно зарегистрирован. Проверьте вашу почту для подтверждения регистрации.');
                  }
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Ошибка при регистрации пользователя:', error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/confirm/:token', async (req, res) => {
  try {
    const token = req.params.token;

    // Раскодирование токена
    const decoded = jwt.verify(token, config.jwtSecret);
    const { userId, email } = decoded;

    // Поиск кода подтверждения в базе данных
    dbConnection.query(
      `SELECT * FROM email_confirmation WHERE userId = ? AND emailConfirmToken = ?`,
      [userId, token],
      (err, results) => {
        if (err) {
          console.error('Ошибка выполнения запроса: ' + err.stack);
          res.status(500).send('Ошибка сервера');
          return;
        }

        if (results.length === 0) {
          res.status(404).send('Код подтверждения не найден');
          return;
        }

        // Удаление кода подтверждения из таблицы email_confirmation
        dbConnection.query(
          `DELETE FROM email_confirmation WHERE userId = ? AND emailConfirmToken = ?`,
          [userId, token],
          (err, result) => {
            if (err) {
              console.error('Ошибка удаления кода подтверждения: ' + err.stack);
              res.status(500).send('Ошибка сервера');
              return;
            }

            console.log('Код подтверждения успешно удален');

            // Обновление поля isConfirmed для пользователя
            dbConnection.query(
              'UPDATE users SET isConfirmed = true WHERE id = ?',
              [userId],
              (err, result) => {
                if (err) {
                  console.error('Ошибка обновления пользователя: ' + err.stack);
                  res.status(500).send('Ошибка сервера');
                  return;
                }

                res.status(200).send('Регистрация успешно подтверждена');
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Ошибка при подтверждении регистрации:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Вход пользователя
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        dbConnection.query(
            'SELECT * FROM users WHERE username = ?',
            [username],
            async (err, results) => {
                if (err) {
                    console.error('Ошибка выполнения запроса:', err);
                    res.status(500).send('Ошибка сервера');
                    return;
                }
                if (results.length === 0) {
                    res.status(401).send('Неверные учетные данные');
                    return;
                }
                const user = results[0];
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (!passwordMatch) {
                    res.status(401).send('Неверные учетные данные');
                    return;
                }
                if (!user.isConfirmed) {
                    res.status(401).send('Почта не подтверждена');
                    return;
                }
                // Генерация JWT с userId
                const token = jwt.sign({ userId: user.id, username: user.username }, config.jwtSecret, { expiresIn: '1h' });
                res.status(200).json({ token });
            }
        );
    } catch (error) {
        console.error('Ошибка при входе пользователя:', error);
        res.status(500).send('Ошибка сервера');
    }
});


// Сброс пароля
app.post('/forgotPassword', async (req, res) => {
  const { email } = req.body;

  dbConnection.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Ошибка выполнения запроса: ' + err.stack);
      res.status(500).send('Ошибка сервера');
      return;
    }
    if (results.length === 0) {
      res.status(404).send('Пользователь с таким email не найден');
      return;
    }

    const user = results[0];
    const resetToken = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '1h' });

    const mailOptions = {
      from: 'nodemailer1@yandex.ru',
      to: email,
      subject: 'Сброс пароля',
      html: `<p>Для сброса пароля перейдите по ссылке: <a href="http://localhost:3000/reset-password.html?token=${resetToken}">Сбросить пароль</a></p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Ошибка при отправке письма:', error);
        res.status(500).send('Ошибка сервера');
      } else {
        console.log('Письмо для сброса пароля отправлено:', info.response);
        res.status(200).send('Письмо для сброса пароля отправлено на вашу почту');
      }
    });
  });
});

app.post('/resetPassword/:token', async (req, res) => {
  const token = req.params.token;
  const { newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const { userId } = decoded;

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    dbConnection.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err, result) => {
      if (err) {
        console.error('Ошибка выполнения запроса: ' + err.stack);
        res.status(500).send('Ошибка сервера');
        return;
      }
      res.status(200).send('Пароль успешно сброшен');
    });
  } catch (error) {
    console.error('Ошибка при сбросе пароля:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Проверка аутентификации с использованием JWT
app.get('/profile', (req, res) => {
  // Получение токена из заголовка Authorization
  const token = req.headers.authorization.split(' ')[1];
  try {
    // Проверка токена
    const decoded = jwt.verify(token, config.jwtSecret);
    res.status(200).json({ username: decoded.username });
  } catch (error) {
    console.error('Ошибка при проверке токена:', error);
    res.status(401).send('Неверный токен');
  }
});

app.get('/events', (req, res) => {
    dbConnection.query('SELECT * FROM events', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Ошибка сервера');
        } else {
            res.json(results);
        }
    });
});





app.put('/applications/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    dbConnection.query(
        'UPDATE applications SET status = ? WHERE id = ?',
        [status, id],
        (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Ошибка сервера');
            } else {
                dbConnection.query(
                    'SELECT users.email FROM applications JOIN users ON applications.user_id = users.id WHERE applications.id = ?',
                    [id],
                    (err, results) => {
                        if (!err && results.length > 0) {
                            const email = results[0].email;
                            transporter.sendMail({
                                from: 'noreply@example.com',
                                to: email,
                                subject: 'Обновление статуса заявки',
                                text: `Ваш статус заявки обновлен на ${status}.`
                            });
                        }
                    }
                );
                res.send('Статус заявки обновлен');
            }
        }
    );
});









// Запуск сервера
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});


