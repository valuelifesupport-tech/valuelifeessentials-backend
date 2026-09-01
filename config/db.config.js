require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  mysql: {
    host: process.env.MYSQL_HOST || 'srv831.hstgr.io',
    user: process.env.MYSQL_USER || 'u439830852_admin',
    password: process.env.MYSQL_PASSWORD || 'Valuelife@support1',
    database: process.env.MYSQL_DATABASE || 'u439830852_valuelife',
    port: Number(process.env.MYSQL_PORT) || 3306
  }
};
