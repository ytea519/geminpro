# Banana Pro AI - 创意画板

一个基于 Node.js + Express 的 AI 图片生成平台，支持多图上传、社区画廊分享等功能。

## 🚀 快速开始

### 方法1: 使用启动脚本（推荐）

```bash
./start.sh
```

这会同时启动主应用和模拟API服务器。

### 方法2: 手动启动

1. 启动模拟API服务器：
```bash
node mock-api.js
```

2. 在新终端启动主应用：
```bash
OPENAI_API_URL=http://127.0.0.1:8000/v1/chat/completions node server.js
```

3. 访问 http://localhost:3000

## 🔐 登录信息

- **密码**: `123456`

## 🎨 功能特性

- ✅ **AI图片生成**: 支持文本提示词生成图片
- ✅ **多图上传**: 可上传最多16张参考图片
- ✅ **拖拽上传**: 支持拖拽文件到输入区域
- ✅ **个人画廊**: 本地存储历史作品
- ✅ **社区画廊**: 分享作品到公共画廊
- ✅ **响应式设计**: 支持移动端和桌面端
- ✅ **图片下载**: 支持下载生成的图片
- ✅ **参数复用**: 可复用历史作品的参数和图片

## 📁 项目结构

```
banana-pro-ai/
├── index.html          # 前端主页面
├── style.css           # 样式文件
├── server.js           # 后端服务器
├── mock-api.js         # 模拟API服务器
├── start.sh            # 启动脚本
├── .env                # 环境配置
├── data/               # 数据目录
│   └── public-gallery.json  # 公共画廊数据
└── package.json        # 项目配置
```

## ⚙️ 配置说明

### 环境变量 (.env)

```env
# API Configuration
OPENAI_API_KEY=sk-123456
OPENAI_API_URL=http://127.0.0.1:8000/v1/chat/completions
MODEL_NAME=banana-pro

# Site Configuration  
SITE_PASSWORD=123456
PORT=3000

# Gallery Configuration
PUBLIC_GALLERY_LIMIT=80
```

## 🛠️ 开发说明

### 模拟API

项目包含一个模拟API服务器 (`mock-api.js`)，用于演示和测试：

- 生成彩色SVG图片作为响应
- 模拟2-5秒的处理延迟
- 兼容OpenAI API格式

### 真实API配置

要使用真实的图片生成API，请修改 `.env` 文件：

```env
OPENAI_API_KEY=your_actual_api_key
OPENAI_API_URL=https://your-api-provider.com/v1/chat/completions
```

### API响应格式

API应返回OpenAI兼容格式：

```json
{
  "choices": [{
    "message": {
      "content": "![Generated Image](data:image/png;base64,...)"
    }
  }]
}
```

## 🐛 故障排除

### 常见问题

1. **生图失败: 无法从 API 响应中提取图片数据**
   - 检查API地址配置是否正确
   - 确认API密钥有效
   - 查看服务器日志了解详细错误

2. **社区创意画廊加载很慢**
   - 检查网络连接
   - 查看浏览器控制台错误信息
   - 确认服务器正常运行

3. **端口占用**
   ```bash
   # 查看端口占用
   lsof -i :3000
   lsof -i :8000
   
   # 停止相关进程
   pkill -f "node server.js"
   pkill -f "node mock-api.js"
   ```

## 📱 移动端优化

- 单列布局，便于触摸操作
- 减少动画复杂度，提升性能
- 图片自动压缩，减少网络负载
- 响应式设计，适配各种屏幕

## 🔄 版本历史

- v1.0.0: 初始版本，支持基础生图功能
- v1.1.0: 添加多图上传、社区画廊
- v1.2.0: 移动端优化、性能改进
- v1.3.0: 错误处理改进、模拟API

## 📄 许可证

MIT License