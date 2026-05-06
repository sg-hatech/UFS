const colors = {
  cash: "#2f7d6d",
  cpf: "#b58b36",
  srs: "#7e4261",
  property: "#8b6a2e",
  total: "#2d7f83",
  before: "#9f2f24",
  objectiveBlue: "#2f6797",
  objectiveBlueDark: "#204b70",
  objectiveGreen: "#2f7d6d",
  objectiveGreenDark: "#1f584d",
  objectiveYellow: "#b58b36",
  objectiveYellowDark: "#7b5a20"
};

const years = [0, 2, 4, 6, 8, 10, 12, 14];
const cpfOrdinaryWageCeiling = 8000 * 12;
const cpfAnnualSalaryCeiling = 102000;
const cpfContributionRates = [
  { maxAge: 55, employer: 0.17, employee: 0.20 },
  { maxAge: 60, employer: 0.16, employee: 0.18 },
  { maxAge: 65, employer: 0.125, employee: 0.125 },
  { maxAge: 70, employer: 0.09, employee: 0.075 },
  { maxAge: Infinity, employer: 0.075, employee: 0.05 }
];
const cpfAllocationRates = [
  { maxAge: 35, oa: 0.6217, sa: 0.1621, ma: 0.2162 },
  { maxAge: 45, oa: 0.5677, sa: 0.1891, ma: 0.2432 },
  { maxAge: 50, oa: 0.5136, sa: 0.2162, ma: 0.2702 },
  { maxAge: 55, oa: 0.4055, sa: 0.3108, ma: 0.2837 },
  { maxAge: 60, oa: 0.3530, sa: 0.3382, ma: 0.3088 },
  { maxAge: 65, oa: 0.1400, sa: 0.4400, ma: 0.4200 },
  { maxAge: 70, oa: 0.0607, sa: 0.3030, ma: 0.6363 },
  { maxAge: Infinity, oa: 0.0800, sa: 0.0800, ma: 0.8400 }
];
let currentMode = "after";
let proposedSummarySeeded = false;
const proposedAssetDefinitions = [
  { key: "investmentProperty", label: "Investment Properties", source: null, roi: 0, color: "#b58b36" },
  { key: "shares", label: "Shares / Unit Trusts", source: "shares", roi: 3, color: "#7e4261" },
  { key: "uaf", label: "Unicorn Advised Fund", source: "uaf", roi: 5, color: "#2f7d6d" },
  { key: "bank", label: "Bank Deposits", source: "cash", roi: 1, color: "#d7a84d" },
  { key: "cpfOa", label: "CPF OA", source: "cpfOa", roi: 2.5, color: "#2f6797" },
  { key: "cpfSa", label: "CPF SA", source: "cpfSa", roi: 4, color: "#5d7f95" },
  { key: "cpfMa", label: "CPF MA", source: "cpfMa", roi: 4, color: "#9f2f24" },
  { key: "cpfRa", label: "CPF RA", source: null, roi: 4, color: "#8b6a2e" },
  { key: "cashValue", label: "Cash Value in Life Insurance", source: "annuity", roi: 1.5, color: "#6aa9a1" },
  { key: "bonds", label: "Bonds", source: "bond", roi: 2.5, color: "#c7a34d" },
  { key: "business", label: "Business", source: null, roi: 0, color: "#6f5439" },
  { key: "srs", label: "SRS Account", source: "srs", roi: 4, color: "#7b2d27" },
  { key: "pension", label: "Pension Fund", source: null, roi: 0, color: "#8a8175" },
  { key: "alternative", label: "Alternative Investments", source: null, roi: 0, color: "#1f6f64" },
  { key: "others", label: "Others", source: "others", roi: 0, color: "#a89984" }
];

const svg = document.getElementById("projectionChart");
const legend = document.getElementById("legend");
const chartTitle = document.getElementById("chartTitle");
const assetAtFi = document.getElementById("assetAtFi");
const annualIncome = document.getElementById("annualIncome");
const monthlyIncome = document.getElementById("monthlyIncome");
const improvement = document.getElementById("improvement");

function inputValue(selector) {
  const input = document.querySelector(selector);
  return input ? Number(input.value || 0) : 0;
}

function sumInputs(selector) {
  return [...document.querySelectorAll(selector)].reduce((total, input) => total + Number(input.value || 0), 0);
}

function formatCurrency(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}S$${Math.abs(Math.round(value)).toLocaleString("en-SG")}`;
}

function moneyLabel(value) {
  if (value >= 1000000) return `S$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  return `S$${Math.round(value / 1000)}K`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = formatCurrency(value);
  document.querySelectorAll(`[data-mirror="${id}"]`).forEach((mirror) => {
    mirror.textContent = formatCurrency(value);
  });
}

function collectObjectives() {
  const age = inputValue('[data-profile="age"]') || 0;
  return [...document.querySelectorAll(".objective-table tbody tr")]
    .map((row, index) => {
      const objective = row.querySelector("[data-objective-name]")?.value.trim() || "";
      const yearsToAchieve = Number(row.querySelector("[data-objective-years]")?.value || 0);
      const amount = Number(row.querySelector("[data-objective-amount]")?.value || 0);
      const priority = row.querySelector("[data-objective-priority]")?.value || "Medium";
      return {
        objective,
        yearsToAchieve,
        amount,
        priority,
        targetAge: age + yearsToAchieve,
        index
      };
    })
    .filter((item) => item.objective && (item.yearsToAchieve > 0 || item.amount > 0));
}

function updateObjectiveVisuals() {
  const timeline = document.getElementById("objectiveTimeline");
  if (!timeline) return;

  const objectives = collectObjectives();
  timeline.replaceChildren();

  if (!objectives.length) {
    timeline.textContent = "Enter objectives to build the timeline.";
    return;
  }

  const maxYears = Math.max(1, ...objectives.map((item) => item.yearsToAchieve));
  const currentAge = inputValue('[data-profile="age"]') || 0;
  const objectiveColors = [
    { fill: colors.objectiveBlue, marker: colors.objectiveBlueDark },
    { fill: colors.objectiveGreen, marker: colors.objectiveGreenDark },
    { fill: colors.objectiveYellow, marker: colors.objectiveYellowDark }
  ];
  const lineY = 318;
  const currentAgePosition = 9;

  const axisLabel = document.createElement("div");
  axisLabel.className = "timeline-axis-label";
  axisLabel.textContent = "Age";
  timeline.appendChild(axisLabel);

  const currentTick = document.createElement("div");
  currentTick.className = "current-age-tick";
  currentTick.style.setProperty("--pos", `${currentAgePosition}%`);
  timeline.appendChild(currentTick);

  const currentAgeLabel = document.createElement("div");
  currentAgeLabel.className = "current-age-label";
  currentAgeLabel.style.setProperty("--pos", `${currentAgePosition}%`);
  currentAgeLabel.textContent = currentAge;
  timeline.appendChild(currentAgeLabel);

  const endLabel = document.createElement("div");
  endLabel.className = "timeline-end-label";
  endLabel.innerHTML = "Lifetime<br>Joy & Prosperity";
  timeline.appendChild(endLabel);

  objectives
    .slice()
    .sort((a, b) => a.yearsToAchieve - b.yearsToAchieve)
    .forEach((item, index, sortedItems) => {
      const position = Math.max(18, Math.min(86, currentAgePosition + (item.yearsToAchieve / maxYears) * 72));
      const colorSet = objectiveColors[item.index] || objectiveColors[0];
      const heightSlots = [206, 126, 46];
      const slotIndex = sortedItems.length === 1 ? 2 : Math.round(index * 2 / Math.max(1, sortedItems.length - 1));
      const cardTop = heightSlots[Math.min(2, slotIndex)];
      const card = document.createElement("div");
      card.className = "objective-card";
      card.style.setProperty("--pos", `${position}%`);
      card.style.setProperty("--top", `${cardTop}px`);
      card.style.setProperty("--bar-color", colorSet.fill);
      card.innerHTML = `<h4>${item.objective}</h4>`;
      timeline.appendChild(card);

      const marker = document.createElement("div");
      marker.className = "objective-marker";
      marker.style.setProperty("--pos", `${position}%`);
      marker.style.setProperty("--marker-dark", colorSet.marker);
      marker.innerHTML = `<strong>${item.targetAge}</strong>`;
      timeline.appendChild(marker);

      const arrow = document.createElement("div");
      arrow.className = "objective-arrow";
      arrow.style.setProperty("--pos", `${position}%`);
      arrow.style.setProperty("--top", `${cardTop}px`);
      arrow.style.setProperty("--line-y", `${lineY}px`);
      timeline.appendChild(arrow);

      const ageLabel = document.createElement("div");
      ageLabel.className = "timeline-age-label";
      ageLabel.style.setProperty("--pos", `${position}%`);
      ageLabel.textContent = item.targetAge;
      timeline.appendChild(ageLabel);
    });
}

function setCpfOutput(name, value) {
  const input = document.querySelector(`[data-cpf-output="${name}"]`);
  if (!input) return;
  input.value = typeof value === "number" ? Math.round(value) : value;
}

function assetAmount(source) {
  if (!source) return 0;
  return inputValue(`[data-asset="${source}"]`);
}

function setupProposedAssetRows() {
  const tbody = document.getElementById("proposedAssetRows");
  if (!tbody || tbody.children.length) return;

  proposedAssetDefinitions.forEach((item) => {
    const row = document.createElement("tr");
    row.dataset.proposedAssetRow = item.key;
    row.innerHTML = `
      <td>${item.label}</td>
      <td class="money-cell" data-proposed-current="${item.key}">S$0</td>
      <td><input type="number" min="0" step="1000" data-proposed-amount="${item.key}" value="0"></td>
      <td><input type="number" min="0" step="0.1" data-proposed-roi="${item.key}" value="${item.roi}"></td>
      <td class="return-cell" data-proposed-return="${item.key}">S$0</td>
      <td class="allocation-cell" data-proposed-allocation="${item.key}">0%</td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll("[data-proposed-amount]").forEach((input) => {
    input.addEventListener("input", () => {
      input.dataset.touched = "true";
      draw(currentMode);
    });
  });

  tbody.querySelectorAll("[data-proposed-roi]").forEach((input) => {
    input.addEventListener("input", () => draw(currentMode));
  });
}

function updateProposedAssetAllocation() {
  setupProposedAssetRows();
  const donut = document.getElementById("proposedAssetDonut");
  const legend = document.getElementById("proposedAssetLegend");
  if (!donut || !legend) return;

  let currentTotal = 0;
  let proposedTotal = 0;
  let returnTotal = 0;
  const chartItems = [];

  proposedAssetDefinitions.forEach((item) => {
    const current = assetAmount(item.source);
    const proposedInput = document.querySelector(`[data-proposed-amount="${item.key}"]`);
    const roiInput = document.querySelector(`[data-proposed-roi="${item.key}"]`);
    if (proposedInput && proposedInput.dataset.touched !== "true") proposedInput.value = Math.round(current);

    const proposed = Number(proposedInput?.value || 0);
    const roi = Number(roiInput?.value || 0);
    const annualReturn = proposed * roi / 100;
    currentTotal += current;
    proposedTotal += proposed;
    returnTotal += annualReturn;
    chartItems.push({ ...item, proposed });

    const currentCell = document.querySelector(`[data-proposed-current="${item.key}"]`);
    const returnCell = document.querySelector(`[data-proposed-return="${item.key}"]`);
    if (currentCell) currentCell.textContent = current ? formatCurrency(current) : "-";
    if (returnCell) returnCell.textContent = annualReturn ? formatCurrency(annualReturn) : "-";
  });

  proposedAssetDefinitions.forEach((item) => {
    const proposed = Number(document.querySelector(`[data-proposed-amount="${item.key}"]`)?.value || 0);
    const allocationCell = document.querySelector(`[data-proposed-allocation="${item.key}"]`);
    if (allocationCell) allocationCell.textContent = proposedTotal ? `${(proposed / proposedTotal * 100).toFixed(1)}%` : "0%";
  });

  const awr = proposedTotal ? returnTotal / proposedTotal * 100 : 0;
  setText("proposedCurrentTotal", currentTotal);
  setText("proposedAmountTotal", proposedTotal);
  setText("proposedTableReturnTotal", returnTotal);
  const tableAwrEl = document.getElementById("proposedTableAwr");
  if (tableAwrEl) tableAwrEl.textContent = `${awr.toFixed(2)}%`;
  const allocationTotal = document.getElementById("proposedAllocationTotal");
  if (allocationTotal) allocationTotal.textContent = proposedTotal ? "100%" : "0%";

  if (!proposedSummarySeeded) {
    const assetSummary = document.getElementById("summaryProposedAssetTotal");
    const returnSummary = document.getElementById("summaryProposedReturnTotal");
    const awrSummary = document.getElementById("summaryProposedAwr");
    if (assetSummary) assetSummary.value = formatCurrency(proposedTotal);
    if (returnSummary) returnSummary.value = formatCurrency(returnTotal);
    if (awrSummary) awrSummary.value = `${awr.toFixed(2)}%`;
    proposedSummarySeeded = true;
  }

  let cursor = 0;
  const gradientParts = chartItems
    .filter((item) => item.proposed > 0)
    .map((item) => {
      const start = cursor;
      cursor += item.proposed / proposedTotal * 100;
      return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
  donut.style.background = gradientParts.length ? `conic-gradient(${gradientParts.join(", ")})` : "#efe6d5";

  legend.replaceChildren();
  chartItems
    .filter((item) => item.proposed > 0)
    .forEach((item) => {
      const entry = document.createElement("div");
      entry.innerHTML = `<span><i style="background:${item.color}"></i>${item.label}</span><strong>${(item.proposed / proposedTotal * 100).toFixed(1)}%</strong>`;
      legend.appendChild(entry);
    });
}

function cpfRateForAge(age) {
  return cpfContributionRates.find((rate) => age <= rate.maxAge);
}

function cpfAllocationForAge(age) {
  return cpfAllocationRates.find((rate) => age <= rate.maxAge);
}

function updateCpfContributions() {
  syncProfileToCpf();
  const status = document.querySelector('[data-profile="residentialStatus"]')?.value || "Singapore Citizen";
  if (status === "Foreigner") {
    ["payableWages", "employer", "employee", "oa", "sa", "ma"].forEach((name) => setCpfOutput(name, 0));
    setCpfOutput("eligibility", "Not eligible for CPF");
    return;
  }

  setCpfOutput("eligibility", "Eligible");
  const age = inputValue("[data-cpf-age]") || 40;
  const salary = inputValue('[data-inflow="salary"]');
  const bonus = inputValue('[data-inflow="bonus"]');
  const ordinaryWagesSubject = Math.min(salary, cpfOrdinaryWageCeiling, cpfAnnualSalaryCeiling);
  const additionalWageCeiling = Math.max(0, cpfAnnualSalaryCeiling - ordinaryWagesSubject);
  const bonusSubject = Math.min(bonus, additionalWageCeiling);
  const payableWages = ordinaryWagesSubject + bonusSubject;
  const contributionRate = cpfRateForAge(age);
  const allocationRate = cpfAllocationForAge(age);
  const employer = payableWages * contributionRate.employer;
  const employee = payableWages * contributionRate.employee;
  const totalContribution = employer + employee;
  const ma = totalContribution * allocationRate.ma;
  const sa = totalContribution * allocationRate.sa;
  const oa = Math.max(0, totalContribution - ma - sa);

  setCpfOutput("payableWages", payableWages);
  setCpfOutput("employer", employer);
  setCpfOutput("employee", employee);
  setCpfOutput("oa", oa);
  setCpfOutput("sa", sa);
  setCpfOutput("ma", ma);
}

function calculateAgeFromBirthday(value) {
  if (!value) return null;
  const birthday = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthday.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (today < birthdayThisYear) age -= 1;
  return Math.max(0, age);
}

function syncProfileToCpf() {
  const ageInput = document.querySelector('[data-profile="age"]');
  const cpfAgeInput = document.querySelector("[data-cpf-age]");
  if (ageInput && cpfAgeInput) cpfAgeInput.value = ageInput.value || 0;
}

function updateAgeFromBirthday(birthdaySelector, ageSelector) {
  const birthdayInput = document.querySelector(birthdaySelector);
  const ageInput = document.querySelector(ageSelector);
  const age = calculateAgeFromBirthday(birthdayInput?.value);
  if (ageInput && age !== null) ageInput.value = age;
}

function futureValues(start, contribution, roi) {
  return years.map((year) => {
    let value = start;
    for (let i = 0; i < year; i += 1) {
      value = value * (1 + roi) + contribution;
    }
    return Math.max(0, Math.round(value));
  });
}

function collectPlanningValues() {
  updateCpfContributions();
  const totalAssets = sumInputs("[data-asset]");
  const totalLiabilities = sumInputs("[data-liability]");
  const netWorth = totalAssets - totalLiabilities;

  const cashInflow = inputValue('[data-inflow="salary"]') + inputValue('[data-inflow="bonus"]') + inputValue('[data-inflow="otherCash"]');
  const cpfInflow = inputValue('[data-inflow="cpfOa"]') + inputValue('[data-inflow="cpfSa"]') + inputValue('[data-inflow="cpfMa"]');
  const totalInflow = sumInputs("[data-inflow]");

  const cpfOutflow = inputValue('[data-outflow="mortgageCpf"]') + inputValue('[data-outflow="insuranceCpf"]') + inputValue('[data-outflow="cpfInvestment"]');
  const totalOutflow = sumInputs("[data-outflow]");
  const annualSurplus = totalInflow - totalOutflow;
  const savingsInvestment =
    annualSurplus +
    inputValue('[data-outflow="insuranceCash"]') +
    inputValue('[data-outflow="endowmentAnnuity"]') +
    inputValue('[data-outflow="srsOutflow"]') +
    inputValue('[data-outflow="othersInvestment"]') +
    inputValue('[data-outflow="cpfInvestment"]') +
    inputValue('[data-outflow="cashInvestment"]');
  const cashOutflow = totalOutflow - cpfOutflow;
  const cpfSurplus = cpfInflow - cpfOutflow;

  const homeMortgage = inputValue('[data-liability="homeMortgage"]') + inputValue('[data-liability="investmentMortgage"]');
  const property = Math.max(0, inputValue('[data-asset="property"]') - homeMortgage);
  const cpf = inputValue('[data-asset="cpfOa"]') + inputValue('[data-asset="cpfSa"]') + inputValue('[data-asset="cpfMa"]');
  const srs = inputValue('[data-asset="srs"]');
  const cashPortfolio = Math.max(0,
    inputValue('[data-asset="cash"]') +
    inputValue('[data-asset="shares"]') +
    inputValue('[data-asset="uaf"]') +
    inputValue('[data-asset="bond"]') +
    inputValue('[data-asset="annuity"]') +
    inputValue('[data-asset="others"]') -
    inputValue('[data-liability="creditCard"]') -
    inputValue('[data-liability="overdraft"]') -
    inputValue('[data-liability="renovation"]') -
    inputValue('[data-liability="taxPayable"]') -
    inputValue('[data-liability="others"]')
  );

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    cashInflow,
    cpfInflow,
    totalInflow,
    cashOutflow,
    cpfOutflow,
    totalOutflow,
    annualSurplus,
    cpfSurplus,
    savingsInvestment,
    property,
    cpf,
    srs,
    cashPortfolio
  };
}

function buildProjection() {
  const values = collectPlanningValues();
  const positiveSurplus = Math.max(0, values.annualSurplus);
  const beforeContribution = positiveSurplus * 0.65;
  const afterContribution = positiveSurplus + values.savingsInvestment * 0.2;

  const beforeTotal = futureValues(values.netWorth, beforeContribution, 0.03);

  const cashContribution = afterContribution * 0.38;
  const cpfContribution = Math.max(0, values.cpfSurplus) * 0.65;
  const srsContribution = Math.max(0, inputValue('[data-inflow="srs"]')) + afterContribution * 0.17;
  const propertyContribution = afterContribution * 0.2;

  const afterSeries = [
    { name: "Cash Portfolio", color: colors.cash, values: futureValues(values.cashPortfolio, cashContribution, 0.045) },
    { name: "CPF Portfolio", color: colors.cpf, values: futureValues(values.cpf, cpfContribution, 0.035) },
    { name: "SRS Portfolio", color: colors.srs, values: futureValues(values.srs, srsContribution, 0.05) },
    { name: "Property / Others", color: colors.gold, values: futureValues(values.property, propertyContribution, 0.025) }
  ];

  const afterTotal = years.map((_, index) => afterSeries.reduce((total, item) => total + item.values[index], 0));

  return {
    before: [
      { name: "Before Implementation", color: colors.before, dashed: true, values: beforeTotal }
    ],
    after: afterSeries,
    compare: [
      { name: "Before Implementation", color: colors.before, dashed: true, values: beforeTotal },
      { name: "After Implementation", color: colors.total, values: afterTotal }
    ],
    summary: {
      beforeAsset: beforeTotal.at(-1),
      afterAsset: afterTotal.at(-1),
      improvement: afterTotal.at(-1) - beforeTotal.at(-1)
    },
    values
  };
}

function summaryFor(mode, projection) {
  const asset = mode === "before" ? projection.summary.beforeAsset : projection.summary.afterAsset;
  const annual = asset * 0.04;
  const monthly = annual / 12;
  const titles = {
    before: "Before Implementation Projection",
    after: "After Implementation Projection",
    compare: "Before vs After Implementation"
  };
  const improvementText = mode === "before"
    ? "Baseline"
    : `${formatCurrency(projection.summary.improvement)} assets, ${formatCurrency(projection.summary.improvement * 0.04)}/year`;

  return {
    title: titles[mode],
    asset: formatCurrency(asset),
    annual: formatCurrency(annual),
    monthly: formatCurrency(monthly),
    improvement: improvementText
  };
}

function updatePlanningTotals() {
  const values = collectPlanningValues();
  updateObjectiveVisuals();
  updateProposedAssetAllocation();
  updateIncomeAllocation(values);
  updateInsuranceNeeds(values);
  setText("totalAssets", values.totalAssets);
  setText("totalLiabilities", values.totalLiabilities);
  setText("netWorth", values.netWorth);
  setText("totalInflow", values.totalInflow);
  setText("totalOutflow", values.totalOutflow);
  setText("annualSurplus", values.annualSurplus);
  setText("cashInflow", values.cashInflow);
  setText("cpfInflow", values.cpfInflow);
  setText("cashOutflow", values.cashOutflow);
  setText("cpfOutflow", values.cpfOutflow);
  setText("savingsInvestment", values.savingsInvestment);
  setText("cpfSurplus", values.cpfSurplus);
}

function updateInsuranceNeeds(values) {
  const desiredInput = document.getElementById("desiredAnnualIncome");
  const tax = inputValue('[data-outflow="tax"]');
  const mortgage = inputValue('[data-outflow="mortgageCash"]') + inputValue('[data-outflow="mortgageCpf"]');
  const livingFromIncome = Math.max(0, values.totalInflow - tax - values.savingsInvestment - mortgage);
  if (desiredInput && desiredInput.dataset.touched !== "true") desiredInput.value = Math.round(livingFromIncome);
  const desiredIncome = Number(desiredInput?.value || 0);
  const currentAssets = Math.max(0, values.netWorth);
  const rows = {
    death: desiredIncome / 0.04 + 30000,
    tpd: desiredIncome / 0.04 + 50000,
    ci: desiredIncome / 0.04 + 100000
  };

  Object.entries(rows).forEach(([key, needs]) => {
    const currentCoverage = Number(document.querySelector(`[data-insurance-current="${key}"]`)?.value || 0);
    const assetsInput = document.querySelector(`[data-insurance-assets="${key}"]`);
    const defaultAssets = key === "death"
      ? Math.max(0, values.totalAssets - inputValue('[data-asset="property"]') + inputValue('[data-liability="homeMortgage"]'))
      : inputValue('[data-asset="cash"]') + inputValue('[data-asset="shares"]');
    if (assetsInput && assetsInput.dataset.touched !== "true") assetsInput.value = Math.round(defaultAssets);
    const rowAssets = Number(assetsInput?.value || 0);
    const surplus = currentCoverage + rowAssets - needs;
    const needsCell = document.querySelector(`[data-insurance-need="${key}"]`);
    const gapCell = document.querySelector(`[data-insurance-gap="${key}"]`);
    if (needsCell) needsCell.textContent = formatCurrency(needs);
    if (gapCell) {
      gapCell.textContent = formatCurrency(surplus);
      gapCell.classList.toggle("surplus-positive", surplus >= 0);
      gapCell.classList.toggle("surplus-negative", surplus < 0);
    }
  });

  const ltcCurrent = document.querySelector('[data-insurance-current="longTermCare"]')?.value || "No";
  const ltcGap = document.querySelector('[data-insurance-gap="longTermCare"]');
  if (ltcGap) {
    if (ltcCurrent === "Yes") {
      ltcGap.textContent = "Covered";
      ltcGap.classList.add("surplus-positive");
      ltcGap.classList.remove("surplus-negative");
    } else if (ltcCurrent === "NA") {
      ltcGap.textContent = "NA";
      ltcGap.classList.add("surplus-positive");
      ltcGap.classList.remove("surplus-negative");
    } else {
      ltcGap.textContent = "Shortfall";
      ltcGap.classList.add("surplus-negative");
      ltcGap.classList.remove("surplus-positive");
    }
  }

  const hospitalCurrent = document.querySelector('[data-insurance-current="hospital"]')?.value || "Yes";
  const hospitalGap = document.querySelector('[data-insurance-gap="hospital"]');
  if (hospitalGap) {
    hospitalGap.textContent = hospitalCurrent === "Yes" ? "Covered" : "Shortfall";
    hospitalGap.classList.toggle("surplus-positive", hospitalCurrent === "Yes");
    hospitalGap.classList.toggle("surplus-negative", hospitalCurrent !== "Yes");
  }
}

function setPercent(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = `${value.toFixed(1)}%`;
}

function setCurrencyText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = formatCurrency(value);
}

function updateIncomeAllocation(values) {
  const tax = inputValue('[data-outflow="tax"]');
  const mortgage = inputValue('[data-outflow="mortgageCash"]') + inputValue('[data-outflow="mortgageCpf"]');
  const savings = values.savingsInvestment;
  const totalInflow = values.totalInflow;
  const living = Math.max(0, totalInflow - tax - savings - mortgage);
  const allocationTotal = tax + savings + mortgage + living;
  const denominator = allocationTotal || 1;
  const taxPct = tax / denominator * 100;
  const savingsPct = savings / denominator * 100;
  const mortgagePct = mortgage / denominator * 100;
  const livingPct = living / denominator * 100;

  setPercent("incomeTaxAllocation", taxPct);
  setPercent("incomeSavingsAllocation", savingsPct);
  setPercent("incomeMortgageAllocation", mortgagePct);
  setPercent("incomeLivingAllocation", livingPct);
  setCurrencyText("incomeTaxAmount", tax);
  setCurrencyText("incomeSavingsAmount", savings);
  setCurrencyText("incomeMortgageAmount", mortgage);
  setCurrencyText("incomeLivingAmount", living);
  setCurrencyText("incomeTotalAmount", allocationTotal);

  const donut = document.getElementById("incomeAllocationDonut");
  if (donut) {
    const taxEnd = taxPct;
    const savingsEnd = taxEnd + savingsPct;
    const mortgageEnd = savingsEnd + mortgagePct;
    donut.style.background = `conic-gradient(var(--green) 0 ${taxEnd}%, var(--blue) ${taxEnd}% ${savingsEnd}%, var(--violet) ${savingsEnd}% ${mortgageEnd}%, var(--gold) ${mortgageEnd}% 100%)`;
  }
}

function create(tag, attrs = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

function draw(mode) {
  svg.replaceChildren();
  currentMode = mode;
  updatePlanningTotals();
  const projection = buildProjection();
  const series = projection[mode];
  const summary = summaryFor(mode, projection);
  const width = 920;
  const height = 440;
  const margin = { top: 28, right: 124, bottom: 58, left: 84 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const allValues = series.flatMap((item) => item.values);
  const maxValue = Math.max(250000, Math.ceil(Math.max(...allValues) / 250000) * 250000);
  const yTicks = 5;

  const x = (year) => margin.left + (year / 14) * innerWidth;
  const y = (value) => margin.top + innerHeight - (value / maxValue) * innerHeight;

  for (let i = 0; i <= yTicks; i += 1) {
    const value = (maxValue / yTicks) * i;
    const yy = y(value);
    svg.appendChild(create("line", { x1: margin.left, x2: margin.left + innerWidth, y1: yy, y2: yy, class: "grid-line" }));
    svg.appendChild(create("text", { x: margin.left - 16, y: yy + 5, "text-anchor": "end", class: "axis-text" }, moneyLabel(value)));
  }

  years.forEach((year) => {
    const xx = x(year);
    svg.appendChild(create("text", { x: xx, y: height - 22, "text-anchor": "middle", class: "axis-text" }, String(year)));
  });

  svg.appendChild(create("text", { x: margin.left + innerWidth / 2, y: height - 4, "text-anchor": "middle", class: "axis-text" }, "Years"));
  svg.appendChild(create("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + innerHeight, stroke: "#9daabd", "stroke-width": 1.5 }));
  svg.appendChild(create("line", { x1: margin.left, x2: margin.left + innerWidth, y1: margin.top + innerHeight, y2: margin.top + innerHeight, stroke: "#9daabd", "stroke-width": 1.5 }));

  const fiX = x(14);
  svg.appendChild(create("line", { x1: fiX, x2: fiX, y1: margin.top, y2: margin.top + innerHeight, class: "fi-line" }));
  svg.appendChild(create("text", { x: fiX - 10, y: margin.top + 18, "text-anchor": "end", class: "axis-text" }, "FI Age 60"));

  series.forEach((item) => {
    const points = item.values.map((value, index) => `${x(years[index])},${y(value)}`).join(" ");
    const polyline = create("polyline", {
      points,
      class: `chart-line${item.dashed ? " before" : ""}`,
      stroke: item.color
    });
    svg.appendChild(polyline);

    item.values.forEach((value, index) => {
      svg.appendChild(create("circle", {
        cx: x(years[index]),
        cy: y(value),
        r: index === item.values.length - 1 ? 5.5 : 4.5,
        fill: item.color,
        class: "point"
      }));
    });

    const finalValue = item.values[item.values.length - 1];
    const finalX = x(14);
    const finalY = y(finalValue);
    const pill = create("g", { class: "value-pill" });
    pill.appendChild(create("rect", { x: finalX + 14, y: finalY - 18, width: 96, height: 32, fill: item.color }));
    pill.appendChild(create("text", { x: finalX + 62, y: finalY + 4, "text-anchor": "middle" }, moneyLabel(finalValue)));
    svg.appendChild(pill);
  });

  legend.replaceChildren();
  series.forEach((item) => {
    const entry = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.style.background = item.color;
    if (item.dashed) swatch.style.background = `repeating-linear-gradient(90deg, ${item.color} 0 8px, transparent 8px 13px)`;
    entry.appendChild(swatch);
    entry.append(item.name);
    legend.appendChild(entry);
  });

  chartTitle.textContent = summary.title;
  assetAtFi.textContent = summary.asset;
  annualIncome.textContent = summary.annual;
  monthlyIncome.textContent = summary.monthly;
  improvement.textContent = summary.improvement;
}

document.querySelectorAll(".toggle button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".toggle button").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    draw(button.dataset.mode);
  });
});

document.querySelectorAll("input[type='number']").forEach((input) => {
  input.addEventListener("input", () => draw(currentMode));
});

document.getElementById("desiredAnnualIncome")?.addEventListener("input", (event) => {
  event.target.dataset.touched = "true";
  draw(currentMode);
});

document.querySelectorAll("[data-insurance-assets]").forEach((input) => {
  input.addEventListener("input", (event) => {
    event.target.dataset.touched = "true";
    draw(currentMode);
  });
});

document.querySelectorAll("select[data-insurance-current]").forEach((input) => {
  input.addEventListener("change", () => draw(currentMode));
});

document.querySelectorAll("[data-profile]").forEach((input) => {
  input.addEventListener("input", () => draw(currentMode));
  input.addEventListener("change", () => draw(currentMode));
});

document.querySelectorAll("[data-objective-name], [data-objective-years], [data-objective-amount], [data-objective-priority]").forEach((input) => {
  input.addEventListener("input", () => draw(currentMode));
  input.addEventListener("change", () => draw(currentMode));
});

document.querySelector('[data-profile="birthday"]')?.addEventListener("change", () => {
  updateAgeFromBirthday('[data-profile="birthday"]', '[data-profile="age"]');
  draw(currentMode);
});

document.querySelector('[data-profile="spouseBirthday"]')?.addEventListener("change", () => {
  updateAgeFromBirthday('[data-profile="spouseBirthday"]', '[data-profile="spouseAge"]');
  draw(currentMode);
});

draw("after");
