# 还款计划修改API接口文档

## 概述

本文档详细说明了贷款管理系统中修改还款计划的API接口，包括单期修改和批量修改功能。

## 基础信息

- **基础URL**: `http://localhost:8080/api/v1`
- **认证方式**: Bearer Token
- **内容类型**: `application/json`
- **权限要求**: 管理员权限

## API接口

### 1. 修改单期还款计划

**接口地址**: `PUT /loans/{loan_id}/repayment-schedule/{period_number}`

**接口说明**: 修改指定贷款的指定期数还款计划

**权限要求**: 管理员

**路径参数**:
- `loan_id`: 贷款ID
- `period_number`: 期数（从1开始）

**请求参数**:
```json
{
  "due_date": "2025-02-15",        // 还款日期（可选，ISO日期格式）
  "total_amount": 4221.19,         // 应还总额（可选）
  "principal_amount": 2471.19,     // 应还本金（可选）
  "interest_amount": 1750.00,      // 应还利息（可选）
  "late_fee": 0,                   // 滞纳金（可选）
  "notes": "修改原因说明"            // 备注（可选）
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "还款计划修改成功",
  "data": {
    "schedule": {
      "_id": "6847dd7d4e9a96cda1844156",
      "loan_id": "6847dd7d4e9a96cda1844155",
      "period_number": 1,
      "due_date": "2025-02-15T00:00:00.000Z",
      "total_amount": 4221.19,
      "principal_amount": 2471.19,
      "interest_amount": 1750.00,
      "remaining_principal": 497528.81,
      "status": "pending",
      "paid_amount": 0,
      "notes": "修改原因说明",
      "updated_by": "6836bb1a9f1ae95653564a4f",
      "updated_at": "2025-01-10T08:30:15.123Z"
    },
    "loan_status": {
      "repayment_status": "normal",
      "total_paid_amount": 0,
      "paid_periods": 0,
      "payment_progress": 0
    }
  },
  "code": 200,
  "timestamp": "2025-01-10T08:30:15.456Z"
}
```

### 2. 批量修改还款计划

**接口地址**: `PUT /loans/{loan_id}/repayment-schedule/batch`

**接口说明**: 批量修改指定贷款的多期还款计划

**权限要求**: 管理员

**路径参数**:
- `loan_id`: 贷款ID

**请求参数**:
```json
{
  "schedules": [
    {
      "period_number": 1,              // 期数（必填）
      "due_date": "2025-02-15",        // 还款日期（可选）
      "total_amount": 4221.19,         // 应还总额（可选）
      "principal_amount": 2471.19,     // 应还本金（可选）
      "interest_amount": 1750.00,      // 应还利息（可选）
      "late_fee": 0,                   // 滞纳金（可选）
      "notes": "第一期修改"             // 备注（可选）
    },
    {
      "period_number": 2,
      "due_date": "2025-03-15",
      "total_amount": 4221.19,
      "principal_amount": 2480.42,
      "interest_amount": 1740.77,
      "notes": "第二期修改"
    }
  ]
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "批量修改完成，成功2条，失败0条",
  "data": {
    "modified_schedules": [
      {
        "_id": "6847dd7d4e9a96cda1844156",
        "loan_id": "6847dd7d4e9a96cda1844155",
        "period_number": 1,
        "due_date": "2025-02-15T00:00:00.000Z",
        "total_amount": 4221.19,
        "principal_amount": 2471.19,
        "interest_amount": 1750.00,
        "notes": "第一期修改",
        "updated_at": "2025-01-10T08:35:20.789Z"
      },
      {
        "_id": "6847dd7d4e9a96cda1844157",
        "loan_id": "6847dd7d4e9a96cda1844155",
        "period_number": 2,
        "due_date": "2025-03-15T00:00:00.000Z",
        "total_amount": 4221.19,
        "principal_amount": 2480.42,
        "interest_amount": 1740.77,
        "notes": "第二期修改",
        "updated_at": "2025-01-10T08:35:20.790Z"
      }
    ],
    "errors": [],
    "loan_status": {
      "repayment_status": "normal",
      "total_paid_amount": 0,
      "paid_periods": 0,
      "payment_progress": 0
    }
  },
  "code": 200,
  "timestamp": "2025-01-10T08:35:20.999Z"
}
```

## 前端对接指南

### 1. JavaScript SDK

```javascript
class RepaymentScheduleModifier {
  constructor(apiBaseUrl, token) {
    this.apiBaseUrl = apiBaseUrl;
    this.token = token;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  // 修改单期还款计划
  async modifySchedulePeriod(loanId, periodNumber, updateData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/loans/${loanId}/repayment-schedule/${periodNumber}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updateData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('修改还款计划失败:', error);
      throw error;
    }
  }

  // 批量修改还款计划
  async batchModifySchedule(loanId, schedules) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/loans/${loanId}/repayment-schedule/batch`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ schedules })
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('批量修改还款计划失败:', error);
      throw error;
    }
  }
}
```

### 2. 使用示例

```javascript
// 初始化SDK
const modifier = new RepaymentScheduleModifier('http://localhost:8080/api/v1', 'your_token');

// 修改单期还款日期
async function changeRepaymentDate(loanId, periodNumber, newDate) {
  try {
    const result = await modifier.modifySchedulePeriod(loanId, periodNumber, {
      due_date: newDate,
      notes: `还款日期修改为${newDate}`
    });
    
    console.log('修改成功:', result);
    alert('还款日期修改成功');
    
    // 刷新页面数据
    refreshRepaymentSchedule();
  } catch (error) {
    alert('修改失败: ' + error.message);
  }
}

// 修改单期还款金额
async function changeRepaymentAmount(loanId, periodNumber, amounts) {
  try {
    const { totalAmount, principalAmount, interestAmount } = amounts;
    
    const result = await modifier.modifySchedulePeriod(loanId, periodNumber, {
      total_amount: totalAmount,
      principal_amount: principalAmount,
      interest_amount: interestAmount,
      notes: `金额调整：本金${principalAmount}，利息${interestAmount}`
    });
    
    console.log('修改成功:', result);
    alert('还款金额修改成功');
    
    refreshRepaymentSchedule();
  } catch (error) {
    alert('修改失败: ' + error.message);
  }
}

// 批量调整还款日期
async function batchAdjustDates(loanId, dateAdjustments) {
  try {
    const schedules = dateAdjustments.map(adj => ({
      period_number: adj.periodNumber,
      due_date: adj.newDate,
      notes: `批量调整还款日期为${adj.newDate}`
    }));
    
    const result = await modifier.batchModifySchedule(loanId, schedules);
    
    console.log('批量修改结果:', result);
    
    if (result.errors && result.errors.length > 0) {
      console.warn('部分修改失败:', result.errors);
    }
    
    alert(`批量修改完成，成功${result.modified_schedules.length}条，失败${result.errors.length}条`);
    
    refreshRepaymentSchedule();
  } catch (error) {
    alert('批量修改失败: ' + error.message);
  }
}

// 批量利率调整示例
async function batchAdjustInterestRate(loanId, periodsToAdjust, newRate) {
  try {
    const schedules = periodsToAdjust.map(period => {
      // 重新计算利息
      const newInterest = period.principal_amount * newRate / 12;
      const newTotal = period.principal_amount + newInterest;
      
      return {
        period_number: period.period_number,
        total_amount: Math.round(newTotal * 100) / 100,
        interest_amount: Math.round(newInterest * 100) / 100,
        notes: `利率调整为${(newRate * 100).toFixed(2)}%`
      };
    });
    
    const result = await modifier.batchModifySchedule(loanId, schedules);
    
    console.log('利率调整结果:', result);
    alert(`利率调整完成，成功${result.modified_schedules.length}条`);
    
    refreshRepaymentSchedule();
  } catch (error) {
    alert('利率调整失败: ' + error.message);
  }
}
```

### 3. 表单验证

```javascript
// 验证修改数据
function validateModificationData(data) {
  const errors = [];
  
  // 验证日期格式
  if (data.due_date && !isValidDate(data.due_date)) {
    errors.push('还款日期格式不正确');
  }
  
  // 验证金额
  if (data.total_amount !== undefined && data.total_amount <= 0) {
    errors.push('应还总额必须大于0');
  }
  
  if (data.principal_amount !== undefined && data.principal_amount < 0) {
    errors.push('应还本金不能为负数');
  }
  
  if (data.interest_amount !== undefined && data.interest_amount < 0) {
    errors.push('应还利息不能为负数');
  }
  
  // 验证本金+利息=总额
  if (data.total_amount !== undefined && 
      data.principal_amount !== undefined && 
      data.interest_amount !== undefined) {
    const sum = data.principal_amount + data.interest_amount;
    if (Math.abs(sum - data.total_amount) > 0.01) {
      errors.push('本金和利息之和必须等于总还款额');
    }
  }
  
  return errors;
}

function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}
```

## 业务规则

### 1. 修改限制

- 只能修改状态为`pending`、`overdue`或`partial`的还款计划
- 已完成还款（`paid`状态）的记录不能修改
- 修改后的应还金额不能小于已还金额

### 2. 数据一致性

- 如果同时修改本金、利息和总额，必须满足：本金 + 利息 = 总额
- 修改金额时会自动重新计算已还本金和利息的分配比例
- 修改后会自动更新贷款的整体还款状态

### 3. 事务处理

- 批量修改使用数据库事务，确保数据一致性
- 如果批量修改中有任何错误，会回滚所有更改
- 支持部分成功的批量修改（有成功有失败）

## 错误处理

### 常见错误码

| 错误码 | 描述 | 处理建议 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查请求参数格式和必填项 |
| 401 | 未授权 | 重新登录获取Token |
| 403 | 权限不足 | 确认用户具有管理员权限 |
| 404 | 贷款或还款计划不存在 | 检查贷款ID和期数是否正确 |
| 422 | 数据验证失败 | 检查数据格式和业务规则 |

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "code": 4000,
  "errors": {
    "field_name": ["具体错误信息"]
  },
  "timestamp": "2025-06-10T08:30:15.456Z"
}
```

## 注意事项

1. **权限控制**: 只有管理员可以修改还款计划
2. **数据备份**: 修改前会记录原始数据到操作日志
3. **金额精度**: 所有金额计算保留两位小数
4. **日期格式**: 使用ISO 8601格式（YYYY-MM-DD）
5. **并发控制**: 使用数据库事务避免并发修改冲突
6. **审计日志**: 所有修改操作都会记录到系统日志

## 测试数据

```javascript
// 测试用的贷款ID和期数
const testData = {
  loanId: "6847e2314e9a96cda184420c",
  periodNumber: 1,
  updateData: {
    due_date: "2025-02-15",
    notes: "测试修改"
  },
  batchData: [
    {
      period_number: 2,
      due_date: "2025-03-15",
      notes: "第二期修改"
    },
    {
      period_number: 3,
      due_date: "2025-04-15", 
      notes: "第三期修改"
    }
  ]
};
```

这份文档提供了完整的还款计划修改API接口说明和前端对接指南，可以直接用于前端开发。 