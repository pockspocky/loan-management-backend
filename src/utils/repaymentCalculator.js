const mongoose = require('mongoose');

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
  
  const principal = Number(loan.amount);
  const annualRate = Number(loan.interest_rate) / 100;
  const months = Number(loan.term);
  const monthlyRate = annualRate / 12;
  
  console.log('等额本息计算参数:', { principal, annualRate, months, monthlyRate });
  
  if (monthlyRate === 0) {
    // 无息贷款
    const monthlyPayment = principal / months;
    const schedules = [];
    
    for (let i = 1; i <= months; i++) {
      const dueDate = new Date(loan.created_at || new Date());
      dueDate.setMonth(dueDate.getMonth() + i);
      
      schedules.push({
        loan_id: loan._id,
        period_number: i,
        due_date: dueDate,
        total_amount: Math.round(monthlyPayment * 100) / 100,
        principal_amount: Math.round(monthlyPayment * 100) / 100,
        interest_amount: 0,
        status: 'pending'
      });
    }
    
    await RepaymentSchedule.insertMany(schedules);
    console.log('无息等额本息计划生成完成，共', schedules.length, '期');
    return schedules;
  }
  
  // 有息贷款
  const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                        (Math.pow(1 + monthlyRate, months) - 1);
  
  console.log('月供金额:', monthlyPayment);
  
  let remainingPrincipal = principal;
  const schedules = [];
  
  for (let i = 1; i <= months; i++) {
    const interestPayment = remainingPrincipal * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingPrincipal -= principalPayment;
    
    const dueDate = new Date(loan.created_at || new Date());
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedules.push({
      loan_id: loan._id,
      period_number: i,
      due_date: dueDate,
      total_amount: Math.round(monthlyPayment * 100) / 100,
      principal_amount: Math.round(principalPayment * 100) / 100,
      interest_amount: Math.round(interestPayment * 100) / 100,
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
  
  const principal = Number(loan.amount);
  const annualRate = Number(loan.interest_rate) / 100;
  const months = Number(loan.term);
  const monthlyRate = annualRate / 12;
  const monthlyPrincipal = principal / months;
  
  console.log('等额本金计算参数:', { principal, annualRate, months, monthlyPrincipal });
  
  let remainingPrincipal = principal;
  const schedules = [];
  
  for (let i = 1; i <= months; i++) {
    const interestPayment = remainingPrincipal * monthlyRate;
    const totalPayment = monthlyPrincipal + interestPayment;
    remainingPrincipal -= monthlyPrincipal;
    
    const dueDate = new Date(loan.created_at || new Date());
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedules.push({
      loan_id: loan._id,
      period_number: i,
      due_date: dueDate,
      total_amount: Math.round(totalPayment * 100) / 100,
      principal_amount: Math.round(monthlyPrincipal * 100) / 100,
      interest_amount: Math.round(interestPayment * 100) / 100,
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