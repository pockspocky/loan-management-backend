#!/bin/bash

# 贷款管理系统API测试脚本

BASE_URL="http://localhost:8080/api/v1"

echo "🚀 开始测试贷款管理系统API..."

# 测试健康检查
echo "📊 测试健康检查..."
curl -s "$BASE_URL/../health" | jq '.'

echo -e "\n"

# 测试管理员登录
echo "🔐 测试管理员登录..."
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123456"}')

echo "$ADMIN_LOGIN_RESPONSE" | jq '.'

# 提取管理员token
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | jq -r '.data.token')

echo -e "\n"

# 测试用户注册
echo "👤 测试用户注册..."
USER_REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser2",
    "email":"test2@example.com",
    "password":"123456",
    "real_name":"测试用户2",
    "phone":"13900139001",
    "id_card":"110101199001011235"
  }')

echo "$USER_REGISTER_RESPONSE" | jq '.'

echo -e "\n"

# 测试用户登录
echo "🔑 测试用户登录..."
USER_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser2","password":"123456"}')

echo "$USER_LOGIN_RESPONSE" | jq '.'

# 提取用户token
USER_TOKEN=$(echo "$USER_LOGIN_RESPONSE" | jq -r '.data.token')

echo -e "\n"

# 测试贷款申请
echo "💰 测试贷款申请..."
LOAN_RESPONSE=$(curl -s -X POST "$BASE_URL/loans" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_name":"汽车贷款",
    "amount":200000,
    "interest_rate":5.5,
    "bank":"工商银行",
    "term":60,
    "repayment_method":"equal_payment",
    "purpose":"购买汽车",
    "collateral":"汽车抵押"
  }')

echo "$LOAN_RESPONSE" | jq '.'

# 提取贷款ID
LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.data.loan._id')

echo -e "\n"

# 测试贷款列表查询
echo "📋 测试贷款列表查询..."
curl -s -X GET "$BASE_URL/loans?page=1&per_page=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'

echo -e "\n"

# 测试贷款审批
echo "✅测试贷款审批..."
curl -s -X PATCH "$BASE_URL/loans/$LOAN_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status":"approved",
    "approved_amount":200000,
    "approved_rate":5.5,
    "remark":"审批通过"
  }' | jq '.'

echo -e "\n"

# 测试管理员仪表盘
echo "📊 测试管理员仪表盘..."
curl -s -X GET "$BASE_URL/dashboard/admin" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'

echo -e "\n"

# 测试用户仪表盘
echo "👤 测试用户仪表盘..."
curl -s -X GET "$BASE_URL/dashboard/user" \
  -H "Authorization: Bearer $USER_TOKEN" | jq '.'

echo -e "\n"

# 测试系统日志
echo "📝 测试系统日志..."
curl -s -X GET "$BASE_URL/logs?page=1&per_page=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'

echo -e "\n✅ API测试完成！" 