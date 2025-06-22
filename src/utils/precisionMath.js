const Decimal = require('decimal.js');

// 配置Decimal.js
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
  maxE: 9e15,
  minE: -9e15,
  modulo: Decimal.ROUND_DOWN,
  crypto: false
});

class PrecisionMath {
  static decimal(value) {
    return new Decimal(value || 0);
  }

  static add(a, b) {
    return new Decimal(a).plus(new Decimal(b));
  }

  static subtract(a, b) {
    return new Decimal(a).minus(new Decimal(b));
  }

  static multiply(a, b) {
    return new Decimal(a).times(new Decimal(b));
  }

  static divide(a, b) {
    return new Decimal(a).dividedBy(new Decimal(b));
  }

  static round(value, decimalPlaces = 2) {
    return new Decimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  }

  static toNumber(decimal) {
    return decimal.toNumber();
  }

  static toString(decimal, decimalPlaces = 2) {
    return decimal.toFixed(decimalPlaces);
  }

  static equals(a, b, tolerance = 0.01) {
    const diff = this.abs(this.subtract(a, b));
    return diff.lessThanOrEqualTo(new Decimal(tolerance));
  }

  static abs(value) {
    return new Decimal(value).abs();
  }

  static greaterThan(a, b) {
    return new Decimal(a).greaterThan(new Decimal(b));
  }

  static lessThan(a, b) {
    return new Decimal(a).lessThan(new Decimal(b));
  }

  static greaterThanOrEqualTo(a, b) {
    return new Decimal(a).greaterThanOrEqualTo(new Decimal(b));
  }

  static lessThanOrEqualTo(a, b) {
    return new Decimal(a).lessThanOrEqualTo(new Decimal(b));
  }

  static power(base, exponent) {
    return new Decimal(base).pow(new Decimal(exponent));
  }

  // 等额本息计算
  static calculateEqualInstallment(principal, annualRate, months) {
    const P = new Decimal(principal);
    const r = new Decimal(annualRate).dividedBy(12);
    const n = new Decimal(months);
    
    if (r.equals(0)) {
      return P.dividedBy(n);
    }
    
    const onePlusR = r.plus(1);
    const onePlusRPowN = onePlusR.pow(n);
    const numerator = P.times(r).times(onePlusRPowN);
    const denominator = onePlusRPowN.minus(1);
    
    return numerator.dividedBy(denominator);
  }

  // 等额本金计算
  static calculateEqualPrincipal(principal, annualRate, months) {
    const P = new Decimal(principal);
    const r = new Decimal(annualRate).dividedBy(12);
    const n = new Decimal(months);
    
    const monthlyPrincipal = P.dividedBy(n);
    const firstMonthInterest = P.times(r);
    const firstMonthPayment = monthlyPrincipal.plus(firstMonthInterest);
    
    return {
      monthlyPrincipal,
      firstMonthPayment,
      firstMonthInterest
    };
  }

  static safeDecimal(value, defaultValue = 0) {
    try {
      if (value === null || value === undefined || value === '' || isNaN(value)) {
        return new Decimal(defaultValue);
      }
      return new Decimal(value);
    } catch (error) {
      return new Decimal(defaultValue);
    }
  }
}

module.exports = PrecisionMath; 