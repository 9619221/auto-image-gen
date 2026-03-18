@echo off
chcp 65001 >nul
echo ========================================
echo   亚马逊商品图片生成器 - 启动中...
echo ========================================

:: 启动 Next.js (PM2)
cd /d C:\Users\Administrator\auto-image-gen-dev
call pm2 resurrect 2>nul
call pm2 start ecosystem.config.js 2>nul
echo [OK] Next.js 应用已启动 (端口 3000)

:: 等待应用就绪
timeout /t 3 /nobreak >nul

:: 启动 Cloudflare Tunnel
echo [..] 正在创建外网隧道...
start /b C:\Users\Administrator\cloudflared.exe tunnel --url http://localhost:3000 > tunnel.log 2>&1

:: 等待隧道生成 URL
timeout /t 12 /nobreak >nul

:: 显示访问地址
echo.
echo ========================================
for /f "tokens=*" %%a in ('findstr "trycloudflare.com" tunnel.log') do (
    echo   %%a
)
echo ========================================
echo.
echo   本地访问: http://localhost:3000
echo   关闭窗口不影响运行
echo   停止服务: pm2 stop all
echo.
pause
