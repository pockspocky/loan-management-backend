# 贷款计算与还款管理API对接文档

## 概述

本文档提供贷款管理系统中贷款计算和还款管理相关API的详细对接说明，适用于前端弹窗显示功能的开发。

## 基础信息

- **基础URL**: `http://localhost:8080/api/v1`
- **认证方式**: Bearer Token（JWT）
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## 认证

所有API请求都需要在请求头中包含认证Token：

```javascript
headers: {
  'Authorization': 'Bearer <your_token>',
  'Content-Type': 'application/json'
}
```

## 1. 贷款计算相关API

### 1.1 等额本息计算

**端点**: `POST /loans/calculate/equal-installment`

**描述**: 计算等额本息还款方式的详细信息

**请求参数**:
```json
{
  "principal": 1000000,      // 贷款本金（元）
  "annual_rate": 0.045,      // 年利率（小数形式，如4.5%输入0.045）
  "months": 360              // 还款期数（月）
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "等额本息还款计算成功",
  "data": {
    "type": "equalInstallment",
    "principal": 1000000,
    "annualRate": 0.045,
    "months": 360,
    "monthlyPayment": 5066.85,        // 每月还款额
    "totalPayment": 1824067.12,       // 总还款额
    "totalInterest": 824067.12,       // 总利息
    "schedule": [                     // 还款计划明细
      {
        "period": 1,                  // 期数
        "monthlyPayment": 5066.85,    // 月供总额
        "principalPayment": 1316.85,  // 月供本金
        "interestPayment": 3750.00,   // 月供利息
        "remainingPrincipal": 998683.15 // 剩余本金
      }
      // ... 更多期数
    ]
  },
  "code": 200,
  "timestamp": "2025-06-10T07:06:25.767Z"
}
```

### 1.2 等额本金计算

**端点**: `POST /loans/calculate/equal-principal`

**描述**: 计算等额本金还款方式的详细信息

**请求参数**: 同等额本息

**响应示例**:
```json
{
  "success": true,
  "message": "等额本金还款计算成功",
  "data": {
    "type": "equalPrincipal",
    "principal": 1000000,
    "annualRate": 0.045,
    "months": 360,
    "monthlyPrincipal": 2777.78,      // 每月还本金
    "firstMonthPayment": 6527.78,     // 首月还款额
    "lastMonthPayment": 2788.19,      // 末月还款额
    "totalPayment": 1676875,          // 总还款额
    "totalInterest": 676875,          // 总利息
    "schedule": [
      {
        "period": 1,
        "monthlyPayment": 6527.78,
        "principalPayment": 2777.78,
        "interestPayment": 3750.00,
        "remainingPrincipal": 997222.22
      }
      // ... 更多期数
    ]
  }
}
```

### 1.3 两种还款方式比较

**端点**: `POST /loans/calculate/compare`

**描述**: 比较等额本息和等额本金两种还款方式

**请求参数**: 同上

**响应示例**:
```json
{
  "success": true,
  "message": "还款方式比较成功",
  "data": {
    "equalInstallment": {
      "type": "等额本息",
      "monthlyPayment": 5066.85,
      "totalPayment": 1824067.12,
      "totalInterest": 824067.12,
      "description": "每月还款金额固定，适合收入稳定的借款人"
    },
    "equalPrincipal": {
      "type": "等额本金",
      "firstMonthPayment": 6527.78,
      "lastMonthPayment": 2788.19,
      "totalPayment": 1676875,
      "totalInterest": 676875,
      "description": "前期还款压力大，总利息较少，适合还款能力较强的借款人"
    },
    "comparison": {
      "interestDifference": 147192.12,    // 利息差额（等额本息 - 等额本金）
      "paymentDifference": 147192.12,     // 总还款差额
      "recommendation": "等额本金比等额本息少支付利息 147192.12 元"
    }
  }
}
```

### 1.4 提前还款计算

**端点**: `POST /loans/calculate/prepayment`

**描述**: 计算提前还款可节省的利息

**请求参数**:
```json
{
  "principal": 1000000,              // 原贷款本金
  "annual_rate": 0.045,             // 年利率
  "original_months": 360,           // 原还款期数
  "paid_months": 60,                // 已还期数
  "prepayment_amount": 200000,      // 提前还款金额
  "repayment_type": "equalInstallment" // 还款方式
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "提前还款计算成功",
  "data": {
    "type": "部分提前还款",
    "prepaymentAmount": 200000,
    "newPrincipal": 711579.17,        // 提前还款后剩余本金
    "newMonthlyPayment": 3955.19,     // 新的月供金额
    "savedInterest": 133499.54,       // 节省的利息
    "newTotalInterest": 474977.27,    // 新计划总利息
    "newSchedule": []                 // 新的还款计划
  }
}
```

## 2. 贷款还款管理API

### 2.1 获取贷款还款计划

**端点**: `GET /loans/:loan_id/repayment-schedule`

**描述**: 获取指定贷款的还款计划列表

**请求参数**（URL参数）:
- `loan_id`: 贷款ID
- `page`: 页码（默认1）
- `per_page`: 每页数量（默认50）
- `status`: 还款状态过滤（可选：pending/paid/overdue/partial）

**响应示例**:
```json
{
  "success": true,
  "message": "获取还款计划成功",
  "data": {
    "items": [
      {
        "_id": "xxx",
        "loan_id": "xxx",
        "period_number": 1,                    // 期数
        "due_date": "2025-08-10T07:15:38.008Z", // 到期日期
        "total_amount": 3163.25,               // 应还总额
        "principal_amount": 1288.25,           // 应还本金
        "interest_amount": 1875,               // 应还利息
        "remaining_principal": 498716.75,      // 剩余本金
        "status": "pending",                   // 还款状态
        "paid_amount": 0,                      // 已还金额
        "paid_principal": 0,                   // 已还本金
        "paid_interest": 0,                    // 已还利息
        "paid_date": null,                     // 还款日期
        "payment_method": null,                // 支付方式
        "transaction_id": null,                // 交易号
        "late_fee": 0,                         // 滞纳金
        "notes": null                          // 备注
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 50,
      "total": 240,
      "total_pages": 5
    },
    "payment_stats": {                        // 还款统计
      "total_periods": 240,                   // 总期数
      "paid_periods": 1,                      // 已还期数
      "pending_periods": 239,                 // 待还期数
      "overdue_periods": 0,                   // 逾期期数
      "partial_periods": 0,                   // 部分还款期数
      "total_amount": 759180,                 // 总应还金额
      "paid_amount": 3163.25,                 // 已还金额
      "remaining_amount": 756016.75,          // 剩余应还金额
      "payment_progress": 0                   // 还款进度百分比
    }
  }
}
```

### 2.2 获取贷款还款统计

**端点**: `GET /loans/:loan_id/payment-stats`

**描述**: 获取贷款的详细还款统计信息

**响应示例**:
```json
{
  "success": true,
  "message": "获取还款统计成功",
  "data": {
    "loan_info": {
      "loan_name": "测试贷款",
      "total_payment": 759180,
      "repayment_status": "in_progress",      // 还款状态
      "payment_progress": 0,                  // 还款进度
      "remaining_amount": 756016.75
    },
    "payment_stats": {
      "total_periods": 240,
      "paid_periods": 1,
      "pending_periods": 239,
      "payment_progress": 0
    },
    "overdue_schedules": [],                  // 逾期的还款计划
    "next_payment": {                         // 下期还款信息
      "period_number": 2,
      "due_date": "2025-09-10T07:15:38.008Z",
      "total_amount": 3163.25
    }
  }
}
```

### 2.3 记录还款（仅管理员）

**端点**: `POST /loans/:loan_id/repayment-schedule/:period_number/payment`

**描述**: 记录指定期数的还款

**请求参数**:
```json
{
  "paid_amount": 3163.25,           // 还款金额
  "payment_method": "bank_transfer", // 支付方式
  "transaction_id": "TXN123456",    // 交易号
  "notes": "第一期还款",             // 备注
  "paid_date": "2025-06-10"         // 还款日期（可选）
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "还款记录成功",
  "data": {
    "schedule": {
      // 更新后的还款计划详情
    },
    "loan_status": {
      "repayment_status": "in_progress",
      "total_paid_amount": 3163.25,
      "paid_periods": 1,
      "payment_progress": 0
    }
  }
}
```

### 2.4 修改还款计划（仅管理员）

**端点**: `PUT /loans/:loan_id/repayment-schedule/:period_number`

**描述**: 修改指定期数的还款计划

**请求参数**:
```json
{
  "due_date": "2025-02-15",        // 还款日期（可选）
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
  }
}
```

### 2.5 批量修改还款计划（仅管理员）

**端点**: `PUT /loans/:loan_id/repayment-schedule/batch`

**描述**: 批量修改多期还款计划

**请求参数**:
```json
{
  "schedules": [
    {
      "period_number": 1,
      "due_date": "2025-02-15",
      "total_amount": 4221.19,
      "principal_amount": 2471.19,
      "interest_amount": 1750.00,
      "notes": "第一期修改"
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
      }
    ],
    "errors": [],
    "loan_status": {
      "repayment_status": "normal",
      "total_paid_amount": 0,
      "paid_periods": 0,
      "payment_progress": 0
    }
  }
}
```

## 3. 前端实现示例

### 3.1 贷款计算器弹窗

```javascript
class LoanCalculator {
  constructor(apiBaseUrl, token) {
    this.apiBaseUrl = apiBaseUrl;
    this.token = token;
  }

  // 获取请求头
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  // 等额本息计算
  async calculateEqualInstallment(principal, annualRate, months) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/loans/calculate/equal-installment`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          principal,
          annual_rate: annualRate,
          months
        })
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('等额本息计算失败:', error);
      throw error;
    }
  }

  // 等额本金计算
  async calculateEqualPrincipal(principal, annualRate, months) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/loans/calculate/equal-principal`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          principal,
          annual_rate: annualRate,
          months
        })
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('等额本金计算失败:', error);
      throw error;
    }
  }

  // 比较两种还款方式
  async compareRepaymentMethods(principal, annualRate, months) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/loans/calculate/compare`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          principal,
          annual_rate: annualRate,
          months
        })
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('还款方式比较失败:', error);
      throw error;
    }
  }
}

// 使用示例
const calculator = new LoanCalculator('http://localhost:8080/api/v1', 'your_token');

// 弹窗显示计算结果
async function showLoanCalculation(principal, annualRate, months) {
  try {
    // 并行获取两种计算结果
    const [equalInstallment, equalPrincipal, comparison] = await Promise.all([
      calculator.calculateEqualInstallment(principal, annualRate, months),
      calculator.calculateEqualPrincipal(principal, annualRate, months),
      calculator.compareRepaymentMethods(principal, annualRate, months)
    ]);

    // 显示弹窗
    showCalculationModal({
      equalInstallment,
      equalPrincipal,
      comparison
    });
  } catch (error) {
    alert('计算失败: ' + error.message);
  }
}
```

### 3.2 还款计划管理

```javascript
class RepaymentManager {
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

  // 获取还款计划
  async getRepaymentSchedule(loanId, page = 1, perPage = 50, status = null) {
    try {
      let url = `${this.apiBaseUrl}/loans/${loanId}/repayment-schedule?page=${page}&per_page=${perPage}`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('获取还款计划失败:', error);
      throw error;
    }
  }

  // 获取还款统计
  async getPaymentStats(loanId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/loans/${loanId}/payment-stats`, {
        headers: this.getHeaders()
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('获取还款统计失败:', error);
      throw error;
    }
  }

  // 修改还款计划（管理员功能）
  async modifyRepaymentSchedule(loanId, periodNumber, updateData) {
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

  // 批量修改还款计划（管理员功能）
  async batchModifyRepaymentSchedule(loanId, schedules) {
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

  // 记录还款（管理员功能）
  async recordPayment(loanId, periodNumber, paymentData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/loans/${loanId}/repayment-schedule/${periodNumber}/payment`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(paymentData)
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('记录还款失败:', error);
      throw error;
    }
  }
}

// 使用示例
const repaymentManager = new RepaymentManager('http://localhost:8080/api/v1', 'your_token');

// 显示还款计划弹窗
async function showRepaymentSchedule(loanId) {
  try {
    const data = await repaymentManager.getRepaymentSchedule(loanId, 1, 10);
    
    // 渲染还款计划表格
    renderRepaymentTable(data.items, data.payment_stats);
  } catch (error) {
    alert('获取还款计划失败: ' + error.message);
  }
}

// 修改单期还款计划
async function modifySchedulePeriod(loanId, periodNumber, updateData) {
  try {
    const result = await repaymentManager.modifyRepaymentSchedule(loanId, periodNumber, updateData);
    
    console.log('修改成功:', result);
    // 刷新还款计划列表
    await showRepaymentSchedule(loanId);
    
    alert('还款计划修改成功');
  } catch (error) {
    alert('修改失败: ' + error.message);
  }
}

// 批量修改还款计划
async function batchModifySchedule(loanId, scheduleUpdates) {
  try {
    const result = await repaymentManager.batchModifyRepaymentSchedule(loanId, scheduleUpdates);
    
    console.log('批量修改结果:', result.data);
    
    if (result.errors && result.errors.length > 0) {
      console.warn('部分修改失败:', result.errors);
    }
    
    // 刷新还款计划列表
    await showRepaymentSchedule(loanId);
    
    alert(`批量修改完成，成功${result.modified_schedules.length}条，失败${result.errors.length}条`);
  } catch (error) {
    alert('批量修改失败: ' + error.message);
  }
}

// 修改还款日期示例
function changeRepaymentDate(loanId, periodNumber, newDate) {
  const updateData = {
    due_date: newDate,
    notes: `还款日期修改为${newDate}`
  };
  
  modifySchedulePeriod(loanId, periodNumber, updateData);
}

// 修改还款金额示例
function changeRepaymentAmount(loanId, periodNumber, totalAmount, principalAmount, interestAmount) {
  const updateData = {
    total_amount: totalAmount,
    principal_amount: principalAmount,
    interest_amount: interestAmount,
    notes: `金额调整：本金${principalAmount}，利息${interestAmount}`
  };
  
  modifySchedulePeriod(loanId, periodNumber, updateData);
}

// 批量调整利率示例（假设要调整多期的利息）
function batchAdjustInterestRate(loanId, periodsToAdjust, newRate) {
  const scheduleUpdates = periodsToAdjust.map(period => {
    // 重新计算利息（这里是简化示例）
    const newInterest = period.principal_amount * newRate / 12;
    const newTotal = period.principal_amount + newInterest;
    
    return {
      period_number: period.period_number,
      total_amount: newTotal,
      interest_amount: newInterest,
      notes: `利率调整为${(newRate * 100).toFixed(2)}%`
    };
  });
  
  batchModifySchedule(loanId, scheduleUpdates);
}
```

## 4. 错误处理

### 4.1 常见错误码

| 错误码 | 描述 | 处理建议 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查请求参数格式和必填项 |
| 401 | 未授权/Token失效 | 重新登录获取Token |
| 403 | 权限不足 | 检查用户权限或联系管理员 |
| 404 | 资源不存在 | 检查贷款ID是否正确 |
| 422 | 数据验证失败 | 检查数据格式和业务规则 |
| 500 | 服务器内部错误 | 重试或联系技术支持 |

### 4.2 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "code": 4000,
  "error": {
    "statusCode": 400,
    "errorCode": 4000,
    "status": "fail"
  },
  "timestamp": "2025-06-10T07:06:25.767Z"
}
```

## 5. 注意事项

1. **数值精度**: 所有金额计算保留两位小数
2. **日期格式**: 使用ISO 8601格式（YYYY-MM-DDTHH:mm:ss.sssZ）
3. **利率格式**: 年利率使用小数形式（如4.5%输入0.045）
4. **分页**: 默认每页50条记录，最大200条
5. **缓存**: 计算结果可以前端缓存，还款数据需实时获取
6. **权限**: 普通用户只能查看自己的贷款，管理员可以操作所有贷款

## 6. 测试数据

可以使用以下测试数据进行前端开发：

```javascript
const testData = {
  principal: 1000000,      // 100万元
  annualRate: 0.045,       // 4.5%年利率
  months: 360,             // 30年期
  loanId: "6847db3d3785242332a643a0"
};
```

这份文档涵盖了所有贷款计算和还款管理的API接口，可以直接用于前端弹窗功能的开发。 