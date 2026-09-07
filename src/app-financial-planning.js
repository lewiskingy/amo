/* Retired compatibility module.
   Financial/reporting semantics were consolidated into the current Defined Demand planning model
   (app-estimates-funding.js) and the canonical ReportingModel (app-reporting-model.js).

   This file intentionally has no runtime behaviour. It is retained temporarily because older cached
   shells may still request app-financial-planning.js. In particular it must not wrap renderResource,
   renderDashboard or recreate FTE/day/rate calculations outside ReportingModel. */
