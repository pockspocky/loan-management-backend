const mongoose = require('mongoose');
const PrecisionMath = require('./precisionMath');

// 生成还款计划
async function generateRepaymentSchedule(loan) {
  const RepaymentSchedule = require('../models/RepaymentSchedule');
  
  try {
    console.log('开始生成还款计划，贷款信息:', {
      id: loan._id,
      amount: loan.amount,
      rate: loan.interest_rate,
      term: loan.term,
      method: loan.repayment_method
    });

    // 检查是否已存在还款计划
    const existingCount = await RepaymentSchedule.countDocuments({ loan_id: loan._id });
    if (existingCount > 0) {
      console.log('还款计划已存在，跳过生成');
      return;
    }

    const { amount, interest_rate, term, repayment_method } = loan;
    
    if (repayment_method === 'equal_payment' || 
        repayment_method === 'equal_installment' || 
        repayment_method === '等额本息') {
      return await generateEqualInstallmentSchedule(loan);
    } else if (repayment_method === 'equal_principal' || 
               repayment_method === '等额本金') {
      return await generateEqualPrincipalSchedule(loan);
    } else {
      console.warn('未识别的还款方式，使用等额本息:', repayment_method);
      return await generateEqualInstallmentSchedule(loan);
    }
  } catch (error) {
    console.error('生成还款计划失败:', error);
    throw error;
  }
}

// 生成等额本息还款计划
async function generateEqualInstallmentSchedule(loan) {
  const RepaymentSchedule = require('../models/RepaymentSchedule');
  
  const principal = PrecisionMath.safeDecimal(loan.amount);
  const annualRate = PrecisionMath.divide(PrecisionMath.safeDecimal(loan.interest_rate), 100);
  const months = PrecisionMath.safeDecimal(loan.term);
  const monthlyRate = PrecisionMath.divide(annualRate, 12);
  
  console.log('等额本息计算参数:', { 
    principal: PrecisionMath.toNumber(principal), 
    annualRate: PrecisionMath.toNumber(annualRate), 
    months: PrecisionMath.toNumber(months), 
    monthlyRate: PrecisionMath.toNumber(monthlyRate) 
  });
  
  if (monthlyRate.equals(0)) {
    // 无息贷款
    const monthlyPayment = PrecisionMath.divide(principal, months);
    const schedules = [];
    
    for (let i = 1; i <= PrecisionMath.toNumber(months); i++) {
      const dueDate = new Date(loan.created_at || new Date());
      dueDate.setMonth(dueDate.getMonth() + i);
      
      schedules.push({
        loan_id: loan._id,
        period_number: i,
        due_date: dueDate,
        total_amount: PrecisionMath.toNumber(PrecisionMath.round(monthlyPayment)),
        principal_amount: PrecisionMath.toNumber(PrecisionMath.round(monthlyPayment)),
        interest_amount: 0,
        remaining_principal: PrecisionMath.toNumber(PrecisionMath.round(PrecisionMath.subtract(principal, PrecisionMath.multiply(monthlyPayment, i)))),
        status: 'pending'
      });
    }
    
    await RepaymentSchedule.insertMany(schedules);
    console.log('无息等额本息计划生成完成，共', schedules.length, '期');
    return schedules;
  }
  
  // 有息贷款
  const monthlyPayment = PrecisionMath.calculateEqualInstallment(
    PrecisionMath.toNumber(principal),
    PrecisionMath.toNumber(annualRate), 
    PrecisionMath.toNumber(months)
  );
  
  console.log('月供金额:', PrecisionMath.toNumber(monthlyPayment));
  
  let remainingPrincipal = principal;
  const schedules = [];
  
  for (let i = 1; i <= PrecisionMath.toNumber(months); i++) {
    const interestPayment = PrecisionMath.multiply(remainingPrincipal, monthlyRate);
    const principalPayment = PrecisionMath.subtract(monthlyPayment, interestPayment);
    remainingPrincipal = PrecisionMath.subtract(remainingPrincipal, principalPayment);
    
    const dueDate = new Date(loan.created_at || new Date());
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedules.push({
      loan_id: loan._id,
      period_number: i,
      due_date: dueDate,
      total_amount: PrecisionMath.toNumber(PrecisionMath.round(monthlyPayment)),
      principal_amount: PrecisionMath.toNumber(PrecisionMath.round(principalPayment)),
      interest_amount: PrecisionMath.toNumber(PrecisionMath.round(interestPayment)),
      remaining_principal: PrecisionMath.toNumber(PrecisionMath.round(remainingPrincipal)),
      status: 'pending'
    });
  }
  
  await RepaymentSchedule.insertMany(schedules);
  console.log('等额本息计划生成完成，共', schedules.length, '期');
  return schedules;
}

// 生成等额本金还款计划
async function generateEqualPrincipalSchedule(loan) {
  const RepaymentSchedule = require('../models/RepaymentSchedule');
  
  const principal = PrecisionMath.safeDecimal(loan.amount);
  const annualRate = PrecisionMath.divide(PrecisionMath.safeDecimal(loan.interest_rate), 100);
  const months = PrecisionMath.safeDecimal(loan.term);
  const monthlyRate = PrecisionMath.divide(annualRate, 12);
  const monthlyPrincipal = PrecisionMath.divide(principal, months);
  
  console.log('等额本金计算参数:', { 
    principal: PrecisionMath.toNumber(principal), 
    annualRate: PrecisionMath.toNumber(annualRate), 
    months: PrecisionMath.toNumber(months), 
    monthlyPrincipal: PrecisionMath.toNumber(monthlyPrincipal) 
  });
  
  let remainingPrincipal = principal;
  const schedules = [];
  
  for (let i = 1; i <= PrecisionMath.toNumber(months); i++) {
    const interestPayment = PrecisionMath.multiply(remainingPrincipal, monthlyRate);
    const totalPayment = PrecisionMath.add(monthlyPrincipal, interestPayment);
    remainingPrincipal = PrecisionMath.subtract(remainingPrincipal, monthlyPrincipal);
    
    const dueDate = new Date(loan.created_at || new Date());
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedules.push({
      loan_id: loan._id,
      period_number: i,
      due_date: dueDate,
      total_amount: PrecisionMath.toNumber(PrecisionMath.round(totalPayment)),
      principal_amount: PrecisionMath.toNumber(PrecisionMath.round(monthlyPrincipal)),
      interest_amount: PrecisionMath.toNumber(PrecisionMath.round(interestPayment)),
      remaining_principal: PrecisionMath.toNumber(PrecisionMath.round(remainingPrincipal)),
      status: 'pending'
    });
  }
  
  await RepaymentSchedule.insertMany(schedules);
  console.log('等额本金计划生成完成，共', schedules.length, '期');
  return schedules;
}

module.exports = {
  generateRepaymentSchedule,
  generateEqualInstallmentSchedule,
  generateEqualPrincipalSchedule
}; 