@echo off
echo ============================================
echo 珠宝定制管理系统 - 开发环境启动脚本
echo ============================================
echo.

REM 检查Java版本
echo 检查Java版本...
java -version 2>&1 | findstr "version" >nul
if errorlevel 1 (
    echo 错误: 未找到Java或Java版本不正确
    echo 请安装Java 17或更高版本
    pause
    exit /b 1
)

REM 检查Maven
echo 检查Maven...
mvn -version 2>&1 | findstr "Apache Maven" >nul
if errorlevel 1 (
    echo 警告: 未找到Maven，将尝试使用Maven Wrapper
)

REM 检查MySQL服务
echo 检查MySQL服务...
netstat -an | findstr ":3306" >nul
if errorlevel 1 (
    echo 警告: MySQL服务未在3306端口运行
    echo 请确保MySQL已启动并运行在3306端口
)

REM 创建数据库（如果不存在）
echo 创建数据库...
mysql -u root -p@Group666 -e "CREATE DATABASE IF NOT EXISTS moje_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
if errorlevel 1 (
    echo 警告: 无法连接到MySQL数据库
    echo 请检查MySQL服务是否运行，用户名/密码是否正确
)

REM 清理并构建项目
echo.
echo 清理并构建项目...
call mvnw clean compile -DskipTests

if errorlevel 1 (
    echo 错误: 项目构建失败
    pause
    exit /b 1
)

echo.
echo 项目构建成功！
echo.

REM 启动应用
echo 启动应用...
echo 应用将在 http://localhost:8851 启动
echo API文档将在 http://localhost:8851/swagger-ui.html 可用
echo 健康检查: http://localhost:8851/api/health
echo.

call mvnw spring-boot:run

if errorlevel 1 (
    echo 错误: 应用启动失败
    pause
    exit /b 1
)