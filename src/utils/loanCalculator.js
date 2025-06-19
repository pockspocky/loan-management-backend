/**
 * 贷款计算工具
 * 包含等额本息和等额本金两种还款方式的计算
 */

/**
 * 等额本息还款计算
 * 每月还款金额相同，前期偿还利息较多，后期偿还本金较多
 * 
 * @param {number} principal - 贷款本金（元）
 * @param {number} annualRate - 年利率（小数形式，如5%输入0.05）
 * @param {number} months - 还款期数（月）
 * @returns {Object} 计算结果
 */
function calculateEqualInstallment(principal, annualRate, months) {
  // 参数验证
  if (principal <= 0 || annualRate < 0 || months <= 0) {
    throw new Error('参数错误：本金必须大于0，利率不能为负数，期数必须大于0');
  }

  // 月利率
  const monthlyRate = annualRate / 12;
  
  let monthlyPayment, totalPayment, totalInterest;
  
  if (monthlyRate === 0) {
    // 无息贷款
    monthlyPayment = principal / months;
    totalPayment = principal;
    totalInterest = 0;
  } else {
    // 等额本息月还款额公式：
    // A = P * [r(1+r)^n] / [(1+r)^n - 1]
    // 其中：A=月还款额，P=本金，r=月利率，n=还款期数
    const factor = Math.pow(1 + monthlyRate, months);
    monthlyPayment = principal * (monthlyRate * factor) / (factor - 1);
    totalPayment = monthlyPayment * months;
    totalInterest = totalPayment - principal;
  }

  // 计算每期详细信息
  const schedule = [];
  let remainingPrincipal = principal;

  for (let period = 1; period <= months; period++) {
    let interestPayment, principalPayment;
    
    if (monthlyRate === 0) {
      interestPayment = 0;
      principalPayment = monthlyPayment;
    } else {
      // 当期利息 = 剩余本金 * 月利率
      interestPayment = remainingPrincipal * monthlyRate;
      // 当期本金 = 月还款额 - 当期利息
      principalPayment = monthlyPayment - interestPayment;
    }
    
    remainingPrincipal -= principalPayment;
    
    // 处理最后一期的舍入误差
    if (period === months && remainingPrincipal !== 0) {
      principalPayment += remainingPrincipal;
      remainingPrincipal = 0;
    }

    schedule.push({
      period: period, // 期数
      monthlyPayment: Math.round(monthlyPayment * 100) / 100, // 月供总额
      principalPayment: Math.round(principalPayment * 100) / 100, // 月供本金
      interestPayment: Math.round(interestPayment * 100) / 100, // 月供利息
      remainingPrincipal: Math.round(remainingPrincipal * 100) / 100 // 剩余本金
    });
  }

  return {
    type: 'equalInstallment', // 还款方式
    principal: principal, // 贷款本金
    annualRate: annualRate, // 年利率
    months: months, // 还款期数
    monthlyPayment: Math.round(monthlyPayment * 100) / 100, // 每月还款额
    totalPayment: Math.round(totalPayment * 100) / 100, // 总还款额
    totalInterest: Math.round(totalInterest * 100) / 100, // 总利息
    schedule: schedule // 还款计划
  };
}

/**
 * 等额本金还款计算
 * 每月偿还相同本金，利息逐月递减，初期还款压力大
 * 
 * @param {number} principal - 贷款本金（元）
 * @param {number} annualRate - 年利率（小数形式，如5%输入0.05）
 * @param {number} months - 还款期数（月）
 * @returns {Object} 计算结果
 */
function calculateEqualPrincipal(principal, annualRate, months) {
  // 参数验证
  if (principal <= 0 || annualRate < 0 || months <= 0) {
    throw new Error('参数错误：本金必须大于0，利率不能为负数，期数必须大于0');
  }

  // 月利率
  const monthlyRate = annualRate / 12;
  
  // 每月应还本金 = 贷款本金 / 还款期数
  const monthlyPrincipal = principal / months;
  
  // 计算每期详细信息
  const schedule = [];
  let totalPayment = 0;
  let totalInterest = 0;
  let remainingPrincipal = principal;

  for (let period = 1; period <= months; period++) {
    // 当期利息 = 剩余本金 * 月利率
    const interestPayment = remainingPrincipal * monthlyRate;
    
    // 当期本金（最后一期处理舍入误差）
    let principalPayment = monthlyPrincipal;
    if (period === months) {
      principalPayment = remainingPrincipal;
    }
    
    // 当期月供总额 = 当期本金 + 当期利息
    const monthlyPayment = principalPayment + interestPayment;
    
    // 更新剩余本金
    remainingPrincipal -= principalPayment;
    
    // 累计总额
    totalPayment += monthlyPayment;
    totalInterest += interestPayment;

    schedule.push({
      period: period, // 期数
      monthlyPayment: Math.round(monthlyPayment * 100) / 100, // 月供总额
      principalPayment: Math.round(principalPayment * 100) / 100, // 月供本金
      interestPayment: Math.round(interestPayment * 100) / 100, // 月供利息
      remainingPrincipal: Math.round(remainingPrincipal * 100) / 100 // 剩余本金
    });
  }

  return {
    type: 'equalPrincipal', // 还款方式
    principal: principal, // 贷款本金
    annualRate: annualRate, // 年利率
    months: months, // 还款期数
    monthlyPrincipal: Math.round(monthlyPrincipal * 100) / 100, // 每月还本金
    firstMonthPayment: schedule[0].monthlyPayment, // 首月还款额
    lastMonthPayment: schedule[months - 1].monthlyPayment, // 末月还款额
    totalPayment: Math.round(totalPayment * 100) / 100, // 总还款额
    totalInterest: Math.round(totalInterest * 100) / 100, // 总利息
    schedule: schedule // 还款计划
  };
}

/**
 * 比较两种还款方式
 * 
 * @param {number} principal - 贷款本金（元）
 * @param {number} annualRate - 年利率（小数形式）
 * @param {number} months - 还款期数（月）
 * @returns {Object} 比较结果
 */
function compareRepaymentMethods(principal, annualRate, months) {
  const equalInstallment = calculateEqualInstallment(principal, annualRate, months);
  const equalPrincipal = calculateEqualPrincipal(principal, annualRate, months);
  
  const interestDifference = equalInstallment.totalInterest - equalPrincipal.totalInterest;
  const paymentDifference = equalInstallment.totalPayment - equalPrincipal.totalPayment;
  
  return {
    equalInstallment: {
      type: '等额本息',
      monthlyPayment: equalInstallment.monthlyPayment,
      totalPayment: equalInstallment.totalPayment,
      totalInterest: equalInstallment.totalInterest,
      description: '每月还款金额固定，适合收入稳定的借款人'
    },
    equalPrincipal: {
      type: '等额本金',
      firstMonthPayment: equalPrincipal.firstMonthPayment,
      lastMonthPayment: equalPrincipal.lastMonthPayment,
      totalPayment: equalPrincipal.totalPayment,
      totalInterest: equalPrincipal.totalInterest,
      description: '前期还款压力大，总利息较少，适合还款能力较强的借款人'
    },
    comparison: {
      interestDifference: Math.round(interestDifference * 100) / 100, // 利息差额（等额本息 - 等额本金）
      paymentDifference: Math.round(paymentDifference * 100) / 100, // 总还款差额
      recommendation: interestDifference > 0 ? 
        `等额本金比等额本息少支付利息 ${Math.abs(interestDifference)} 元` :
        `等额本息比等额本金少支付利息 ${Math.abs(interestDifference)} 元`
    }
  };
}

/**
 * 计算提前还款节省的利息
 * 
 * @param {number} principal - 原贷款本金
 * @param {number} annualRate - 年利率
 * @param {number} originalMonths - 原还款期数
 * @param {number} paidMonths - 已还期数
 * @param {number} prepaymentAmount - 提前还款金额
 * @param {string} repaymentType - 还款方式 ('equalInstallment' | 'equalPrincipal')
 * @returns {Object} 提前还款分析
 */
function calculatePrepayment(principal, annualRate, originalMonths, paidMonths, prepaymentAmount, repaymentType = 'equalInstallment') {
  if (paidMonths >= originalMonths) {
    throw new Error('已还期数不能大于等于总期数');
  }
  
  // 计算原还款计划
  const originalPlan = repaymentType === 'equalInstallment' ? 
    calculateEqualInstallment(principal, annualRate, originalMonths) :
    calculateEqualPrincipal(principal, annualRate, originalMonths);
  
  // 计算剩余本金
  const remainingPrincipal = originalPlan.schedule[paidMonths - 1]?.remainingPrincipal || principal;
  
  if (prepaymentAmount > remainingPrincipal) {
    throw new Error('提前还款金额不能超过剩余本金');
  }
  
  // 提前还款后的剩余本金
  const newPrincipal = remainingPrincipal - prepaymentAmount;
  const remainingMonths = originalMonths - paidMonths;
  
  if (newPrincipal <= 0) {
    // 全部提前还清
    return {
      type: '全部提前还清',
      prepaymentAmount: prepaymentAmount,
      savedInterest: originalPlan.schedule.slice(paidMonths)
        .reduce((sum, item) => sum + item.interestPayment, 0),
      newSchedule: []
    };
  }
  
  // 计算新的还款计划
  const newPlan = repaymentType === 'equalInstallment' ? 
    calculateEqualInstallment(newPrincipal, annualRate, remainingMonths) :
    calculateEqualPrincipal(newPrincipal, annualRate, remainingMonths);
  
  // 计算节省的利息
  const originalRemainingInterest = originalPlan.schedule.slice(paidMonths)
    .reduce((sum, item) => sum + item.interestPayment, 0);
  const newTotalInterest = newPlan.totalInterest;
  const savedInterest = originalRemainingInterest - newTotalInterest;
  
  return {
    type: '部分提前还款',
    prepaymentAmount: prepaymentAmount,
    newPrincipal: newPrincipal,
    newMonthlyPayment: newPlan.monthlyPayment || newPlan.firstMonthPayment,
    savedInterest: Math.round(savedInterest * 100) / 100,
    newTotalInterest: newTotalInterest,
    newSchedule: newPlan.schedule
  };
}

module.exports = {
  calculateEqualInstallment,
  calculateEqualPrincipal,
  compareRepaymentMethods,
  calculatePrepayment
}; 