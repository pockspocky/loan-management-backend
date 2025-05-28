#!/bin/bash

echo "🔍 外部连接测试工具"
echo "===================="

# 获取服务器IP
SERVER_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
INTERNAL_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)

echo "📡 服务器信息:"
echo "   - 内网IP: $INTERNAL_IP"
echo "   - 出口IP: $SERVER_IP"
echo ""

# 测试本地连接
echo "🏠 本地连接测试:"
if curl -s --connect-timeout 5 http://localhost:8080/health > /dev/null; then
    echo "   ✅ localhost:8080 - 连接成功"
else
    echo "   ❌ localhost:8080 - 连接失败"
fi

# 测试内网IP连接
echo "🏢 内网连接测试:"
if curl -s --connect-timeout 5 http://$INTERNAL_IP:8080/health > /dev/null; then
    echo "   ✅ $INTERNAL_IP:8080 - 连接成功"
else
    echo "   ❌ $INTERNAL_IP:8080 - 连接失败"
fi

# 检查端口监听状态
echo ""
echo "🔌 端口监听状态:"
netstat -tlnp | grep :8080 | while read line; do
    echo "   📍 $line"
done

# 检查防火墙 (如果存在)
echo ""
echo "🛡️  防火墙检查:"
if command -v ufw &> /dev/null; then
    echo "   UFW状态: $(sudo ufw status | head -1)"
elif command -v iptables &> /dev/null; then
    echo "   iptables规则数: $(sudo iptables -L | wc -l)"
else
    echo "   ✅ 未检测到本地防火墙"
fi

# 测试API接口
echo ""
echo "🔧 API接口测试:"
response=$(curl -s --connect-timeout 5 http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123456"}' 2>/dev/null)

if echo "$response" | jq -r '.success' | grep -q "true"; then
    echo "   ✅ 登录API - 正常工作"
else
    echo "   ❌ 登录API - 异常"
fi

echo ""
echo "📋 配置建议:"
echo "   1. 确保云服务商安全组开放8080端口"
echo "   2. 检查负载均衡器配置"
echo "   3. 前端应使用以下地址:"
echo "      - 内网测试: http://$INTERNAL_IP:8080/api/v1"
echo "      - 外网访问: https://zlyoszudwbcc.sealoshzh.site:8080/api/v1"
echo ""
echo "🚀 服务状态: $(curl -s http://localhost:8080/health | jq -r '.message')" 