@echo off
echo ================================
echo Vue 3 响应式系统可视化演示项目
echo ================================
echo.

echo 检查是否在Vue3根目录...
if not exist "..\packages" (
    echo 请在Vue3项目根目录中运行此脚本！
    pause
    exit /b 1
)

echo 检查workspace依赖...
cd ..
if not exist "node_modules" (
    echo 正在安装workspace依赖...
    call pnpm install
    if %errorlevel% neq 0 (
        echo 依赖安装失败，请检查pnpm是否已安装
        pause
        exit /b 1
    )
)

echo.
echo 依赖安装完成！
echo.
echo 启动demo项目开发服务器...
cd demo
call pnpm dev

pause