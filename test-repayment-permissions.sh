#!/bin/bash

echo "🧪 测试还款接口权限修改"
echo "================================="

BASE_URL="${BASE_URL:-http://localhost:8080}"
API_BASE="$BASE_URL/api/v1"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local token=$4
    local description=$5
    
    echo -e "\n📋 测试: $description"
    echo "🔗 请求: $method $url"
    
    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data" \
            "$url")
    else
        response=$(curl -s -X "$method" \
            -H "Authorization: Bearer $token" \
            "$url")
    fi
    
    echo "📤 响应: $response"
    
    # 检查是否包含成功或权限相关信息
    if echo "$response" | grep -q '"success": *true'; then
        echo -e "✅ ${GREEN}成功${NC}"
    elif echo "$response" | grep -q '"code": *403'; then
        echo -e "🔒 ${YELLOW}权限受限 (符合预期)${NC}"
    elif echo "$response" | grep -q '"success": *false'; then
        echo -e "❌ ${RED}失败${NC}"
    else
        echo -e "⚠️  ${YELLOW}未知响应${NC}"
    fi
}

echo "📝 准备测试数据..."

# 管理员登录
echo "🔐 管理员登录..."
admin_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "admin123456"}' \
    "$API_BASE/auth/login")
clear
admin_token=$(echo "$admin_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$admin_token" ]; then
    echo -e "❌ ${RED}管理员登录失败，无法继续测试${NC}"
    exit 1
fi

echo -e "✅ ${GREEN}管理员登录成功${NC}"

# 普通用户登录
echo "🔐 普通用户登录..."
user_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"username": "testuser5", "password": "123456"}' \
    "$API_BASE/auth/login")

user_token=$(echo "$user_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$user_token" ]; then
    echo -e "❌ ${RED}普通用户登录失败，无法继续测试${NC}"
    exit 1
fi

echo -e "✅ ${GREEN}普通用户登录成功${NC}"

# 获取一个贷款ID用于测试（假设存在）
echo "🔍 获取测试贷款ID..."
loans_response=$(curl -s -X GET \
    -H "Authorization: Bearer $admin_token" \
    "$API_BASE/loans?page=1&per_page=1")

loan_id=$(echo "$loans_response" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$loan_id" ]; then
    echo -e "⚠️  ${YELLOW}没有找到测试贷款，请先创建一些贷款数据${NC}"
    exit 1
fi

echo -e "✅ ${GREEN}找到测试贷款ID: $loan_id${NC}"

echo -e "\n🚀 开始权限测试..."

# 测试1: 管理员记录还款
test_endpoint "POST" \
    "$API_BASE/loans/$loan_id/payments" \
    '{"period_number": 1, "paid_amount": 1000, "payment_method": "bank_transfer", "notes": "管理员测试还款"}' \
    "$admin_token" \
    "管理员记录还款"

# 测试2: 普通用户尝试记录还款（应该检查贷款所有权）
test_endpoint "POST" \
    "$API_BASE/loans/$loan_id/payments" \
    '{"period_number": 2, "paid_amount": 1000, "payment_method": "bank_transfer", "notes": "普通用户测试还款"}' \
    "$user_token" \
    "普通用户记录还款（可能受权限限制）"

# 测试3: 管理员批量修改还款计划
test_endpoint "PUT" \
    "$API_BASE/loans/$loan_id/repayment-schedule/batch" \
    '{"schedules": [{"period_number": 1, "notes": "管理员批量修改测试"}]}' \
    "$admin_token" \
    "管理员批量修改还款计划"

# 测试4: 普通用户批量修改还款计划（应该检查贷款所有权）
test_endpoint "PUT" \
    "$API_BASE/loans/$loan_id/repayment-schedule/batch" \
    '{"schedules": [{"period_number": 1, "notes": "普通用户批量修改测试"}]}' \
    "$user_token" \
    "普通用户批量修改还款计划（可能受权限限制）"

# 测试5: 管理员单期修改还款计划
test_endpoint "PUT" \
    "$API_BASE/loans/$loan_id/repayment-schedule/1" \
    '{"notes": "管理员单期修改测试"}' \
    "$admin_token" \
    "管理员单期修改还款计划"

# 测试6: 普通用户单期修改还款计划（应该检查贷款所有权）
test_endpoint "PUT" \
    "$API_BASE/loans/$loan_id/repayment-schedule/1" \
    '{"notes": "普通用户单期修改测试"}' \
    "$user_token" \
    "普通用户单期修改还款计划（可能受权限限制）"

echo -e "\n📊 测试总结"
echo "================================="
echo "✅ 已移除管理员限制的接口："
echo "   - POST /loans/:loan_id/payments (记录还款)"
echo "   - PUT /loans/:loan_id/repayment-schedule/batch (批量修改还款计划)"
echo "   - PUT /loans/:loan_id/repayment-schedule/:period_number (单期修改还款计划)"
echo ""
echo "🔒 权限控制逻辑："
echo "   - 管理员：可以操作所有贷款"
echo "   - 普通用户：只能操作自己的贷款"
echo ""
echo "📝 注意事项："
echo "   - 如果普通用户尝试操作其他用户的贷款，将返回403错误"
echo "   - 建议在生产环境中进一步测试各种边界情况"

echo -e "\n🎉 ${GREEN}权限修改测试完成！${NC}" 