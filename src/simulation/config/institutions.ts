import type { Institution } from '../types/core.ts'

/**
 * What actually differs between the two institutions.
 *
 * The choice must change objectives, indicators, tools and scoring, not just
 * the label on the screen. The economic asymmetries encoded here are:
 *
 *   - the euro area is far more open, so the exchange rate and imported
 *     inflation matter much more for the ECB;
 *   - impaired transmission takes different forms: sovereign fragmentation
 *     for the ECB, regional banking stress for the Fed;
 *   - the Fed's economy runs with lower structural unemployment and higher
 *     potential growth;
 *   - the ECB's mandate is price-stability-first, which shows up in the
 *     Taylor benchmark's gap weight and in the scoring weights.
 *
 * This is a simplified fictional simulation, not an official Fed or ECB model.
 */
export interface InstitutionConfig {
  readonly id: Institution
  readonly name: string
  readonly shortName: string
  readonly mandateSummary: string
  /** Medium-term inflation objective, %. */
  readonly inflationTarget: number
  /** Trade openness multiplier applied to the exchange-rate demand channel. */
  readonly openness: number
  /** Share of a currency move that reaches headline inflation. */
  readonly importPassThrough: number
  /** Which impairment mechanism the `fragmentation` latent field represents. */
  readonly fragmentationKind: 'sovereign_spread' | 'regional_banks'
  readonly fragmentationLabel: string
  readonly fragmentationUnit: string
  /** Central starting values before the seed perturbs them. */
  readonly initial: {
    readonly policyRate: number
    readonly neutralRealRate: number
    readonly inflationHeadline: number
    readonly inflationCore: number
    readonly unemployment: number
    readonly naturalUnemployment: number
    readonly potentialGrowth: number
    readonly outputGap: number
    readonly wageGrowth: number
    readonly balanceSheet: number
    readonly creditSpread: number
    readonly fragmentation: number
    readonly debtPressure: number
    readonly credibility: number
  }
}

export const INSTITUTIONS: Readonly<Record<Institution, InstitutionConfig>> = {
  fed: {
    id: 'fed',
    name: 'Federal Reserve',
    shortName: 'Fed',
    mandateSummary:
      'A dual mandate: price stability and maximum sustainable employment, ' +
      'with financial stability and institutional credibility as constraints.',
    inflationTarget: 2.0,
    openness: 0.5,
    importPassThrough: 0.06,
    fragmentationKind: 'regional_banks',
    fragmentationLabel: 'Regional banking stress',
    fragmentationUnit: 'index',
    initial: {
      policyRate: 3.0,
      neutralRealRate: 0.8,
      inflationHeadline: 2.6,
      inflationCore: 2.5,
      unemployment: 4.2,
      naturalUnemployment: 4.2,
      potentialGrowth: 2.0,
      outputGap: 0.3,
      wageGrowth: 4.3,
      balanceSheet: 22,
      creditSpread: 1.2,
      fragmentation: 14,
      debtPressure: 38,
      credibility: 72,
    },
  },
  ecb: {
    id: 'ecb',
    name: 'European Central Bank',
    shortName: 'ECB',
    mandateSummary:
      'A symmetric 2 % medium-term inflation objective. Growth and employment ' +
      'are supported only where doing so does not override price stability; ' +
      'transmission, financial stability and credibility are constraints.',
    inflationTarget: 2.0,
    openness: 1.0,
    importPassThrough: 0.13,
    fragmentationKind: 'sovereign_spread',
    fragmentationLabel: 'Sovereign fragmentation spread',
    fragmentationUnit: 'bp',
    initial: {
      policyRate: 2.5,
      neutralRealRate: 0.4,
      inflationHeadline: 2.4,
      inflationCore: 2.4,
      unemployment: 6.6,
      naturalUnemployment: 6.6,
      potentialGrowth: 1.3,
      outputGap: -0.2,
      wageGrowth: 3.6,
      balanceSheet: 34,
      creditSpread: 1.1,
      fragmentation: 55,
      debtPressure: 52,
      credibility: 70,
    },
  },
}

export function getInstitution(id: Institution): InstitutionConfig {
  return INSTITUTIONS[id]
}
