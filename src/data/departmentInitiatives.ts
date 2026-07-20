import type { DepartmentType } from '../types';

export const DEPARTMENT_INITIATIVE_BASE_COST = 200_000;

export interface DepartmentInitiativeEffects {
  employeeMorale?: number;
  employerBrand?: number;
  brandTrust?: number;
  innovation?: number;
  aiCapability?: number;
  consultingCapacity?: number;
  securityPosture?: number;
  computePoints?: number;
  computeInfrastructure?: number;
  cybersecurityPoints?: number;
  legalPoints?: number;
  debt?: number;
  cash?: number;
  scandal?: number;
  departmentMorale?: number;
  allDepartmentMorale?: number;
  departmentEfficiency?: number;
  departmentRisk?: number;
  productQuality?: number;
  productMarketFit?: number;
  productAdopters?: number;
  productScalability?: number;
  productTechnicalDebt?: number;
}

export interface DepartmentInitiativeProfile {
  label: string;
  purpose: string;
  upside: string;
  downside: string;
  productScope: 'linked' | 'portfolio';
  success: DepartmentInitiativeEffects;
  failure: DepartmentInitiativeEffects;
}

export const DEPARTMENT_INITIATIVES: Record<DepartmentType, DepartmentInitiativeProfile> = {
  product_rd: {
    label: 'Moonshot Product Sprint',
    purpose: 'Compress discovery and prototyping into one high-pressure product cycle.',
    upside: 'Innovation, product quality and market fit rise.',
    downside: 'Crunch lowers morale and can create technical debt; failure hurts trust.',
    productScope: 'linked',
    success: { innovation: 4, employeeMorale: -3, departmentMorale: -0.05, departmentEfficiency: 0.03, departmentRisk: 0.05, productQuality: 2, productMarketFit: 3, productTechnicalDebt: 3 },
    failure: { brandTrust: -2, employeeMorale: -5, departmentMorale: -0.08, departmentEfficiency: -0.08, departmentRisk: 0.08, productTechnicalDebt: 6 },
  },
  ai_data: {
    label: 'Compute Surge',
    purpose: 'Run an accelerated data-training and infrastructure cycle.',
    upside: 'Immediate Compute Points, grid capacity and AI capability rise.',
    downside: 'On-call pressure raises risk; failure burns compute and confidence.',
    productScope: 'portfolio',
    success: { aiCapability: 4, computePoints: 12, computeInfrastructure: 2, employeeMorale: -2, departmentMorale: -0.04, departmentRisk: 0.05 },
    failure: { aiCapability: -3, computePoints: -8, employeeMorale: -4, departmentMorale: -0.08, departmentEfficiency: -0.06, departmentRisk: 0.1 },
  },
  cybersecurity: {
    label: 'Zero-Day Readiness Drill',
    purpose: 'Stress-test every defensive layer against a simulated breach.',
    upside: 'Cyber reserve, security posture and market trust rise.',
    downside: 'The drill exhausts staff; failure exposes security weakness to the market.',
    productScope: 'portfolio',
    success: { cybersecurityPoints: 15, securityPosture: 4, brandTrust: 1, employeeMorale: -2, departmentMorale: -0.04, departmentRisk: 0.04 },
    failure: { cybersecurityPoints: -10, securityPosture: -5, brandTrust: -4, employeeMorale: -4, departmentMorale: -0.08, departmentRisk: 0.08 },
  },
  sales_marketing: {
    label: 'Category Blitz',
    purpose: 'Flood active channels with a coordinated category campaign.',
    upside: 'Trust, adoption and product market fit expand market share.',
    downside: 'Campaign fatigue lowers morale; failure damages the brand and adoption.',
    productScope: 'portfolio',
    success: { brandTrust: 4, employeeMorale: -3, departmentMorale: -0.05, departmentRisk: 0.06, productMarketFit: 2, productAdopters: 0.03 },
    failure: { brandTrust: -6, employeeMorale: -4, departmentMorale: -0.08, departmentRisk: 0.09, productAdopters: -0.03 },
  },
  consulting_services: {
    label: 'Transformation War Room',
    purpose: 'Deploy senior teams on a high-profile client transformation.',
    upside: 'Consulting capacity, trust, product fit and fee income rise.',
    downside: 'Utilization pressure hurts morale; failure loses reputation.',
    productScope: 'portfolio',
    success: { consultingCapacity: 5, brandTrust: 2, cash: 120_000, employeeMorale: -3, departmentMorale: -0.05, departmentRisk: 0.05, productMarketFit: 2 },
    failure: { consultingCapacity: -4, brandTrust: -4, employeeMorale: -5, departmentMorale: -0.09, departmentRisk: 0.08 },
  },
  acquisitions: {
    label: 'Deal Pipeline Offensive',
    purpose: 'Build a proprietary target pipeline and rehearse post-deal integration.',
    upside: 'Market credibility, innovation and portfolio fit improve.',
    downside: 'Integration anxiety lowers morale; failure creates scandal and debt exposure.',
    productScope: 'portfolio',
    success: { brandTrust: 3, innovation: 2, employeeMorale: -4, employerBrand: -2, departmentMorale: -0.05, departmentRisk: 0.07, productMarketFit: 1 },
    failure: { brandTrust: -4, employeeMorale: -6, employerBrand: -3, scandal: 6, debt: 100_000, departmentMorale: -0.1, departmentRisk: 0.1 },
  },
  legal_compliance: {
    label: 'Patent Fortress',
    purpose: 'Audit the portfolio and aggressively strengthen its legal perimeter.',
    upside: 'Legal capacity, trust and product credibility rise.',
    downside: 'Review pressure lowers morale; failure creates compliance exposure.',
    productScope: 'portfolio',
    success: { legalPoints: 12, brandTrust: 2, employeeMorale: -2, departmentMorale: -0.03, departmentRisk: 0.03, productQuality: 1 },
    failure: { legalPoints: -5, brandTrust: -3, employeeMorale: -3, scandal: 4, departmentMorale: -0.06, departmentRisk: 0.08 },
  },
  people_culture: {
    label: 'Culture Reset',
    purpose: 'Invest in retention, leadership routines and cross-team recovery.',
    upside: 'Company morale, employer brand and department morale recover.',
    downside: 'Training temporarily reduces HR efficiency; failure looks performative.',
    productScope: 'portfolio',
    success: { employeeMorale: 8, employerBrand: 8, brandTrust: 2, departmentMorale: 0.05, allDepartmentMorale: 0.03, departmentEfficiency: -0.02, departmentRisk: -0.04 },
    failure: { employeeMorale: -8, employerBrand: -7, brandTrust: -2, departmentMorale: -0.08, allDepartmentMorale: -0.05, departmentRisk: 0.08 },
  },
  finance_investor: {
    label: 'Investor Roadshow',
    purpose: 'Trade balance-sheet flexibility for immediate market liquidity.',
    upside: 'Fresh cash and investor trust improve strategic room and market share.',
    downside: 'Debt and internal pressure rise; failure leaves leverage without credibility.',
    productScope: 'portfolio',
    success: { cash: 350_000, debt: 250_000, brandTrust: 3, employeeMorale: -4, departmentMorale: -0.04, departmentRisk: 0.06 },
    failure: { debt: 350_000, brandTrust: -4, employeeMorale: -7, departmentMorale: -0.09, departmentRisk: 0.1 },
  },
  corporate_strategy: {
    label: 'Portfolio Reorganization',
    purpose: 'Reallocate strategic focus around the strongest market positions.',
    upside: 'Trust, innovation and portfolio market fit improve.',
    downside: 'Reorganization fatigue hurts morale; failure confuses customers and teams.',
    productScope: 'portfolio',
    success: { brandTrust: 3, innovation: 3, employeeMorale: -4, employerBrand: -2, departmentMorale: -0.05, departmentRisk: 0.06, productMarketFit: 2 },
    failure: { brandTrust: -3, innovation: -2, employeeMorale: -6, employerBrand: -3, departmentMorale: -0.09, departmentRisk: 0.1, productMarketFit: -2 },
  },
  dev_engineering: {
    label: 'Platform Rewrite',
    purpose: 'Pay down architectural debt while rebuilding the delivery platform.',
    upside: 'Scalability, quality and reusable compute capacity improve.',
    downside: 'Migration pressure hurts morale; failure causes debt, outages and lost compute.',
    productScope: 'linked',
    success: { computePoints: 6, employeeMorale: -3, departmentMorale: -0.06, departmentRisk: 0.06, productScalability: 4, productQuality: 1, productTechnicalDebt: -5 },
    failure: { computePoints: -5, brandTrust: -2, employeeMorale: -5, departmentMorale: -0.1, departmentEfficiency: -0.08, departmentRisk: 0.1, productScalability: -3, productTechnicalDebt: 8 },
  },
};

export const getDepartmentInitiative = (type: DepartmentType): DepartmentInitiativeProfile =>
  DEPARTMENT_INITIATIVES[type];
