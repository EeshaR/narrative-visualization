let currentScene = 0;
let data;
let svg, width, height, margin;

// Scene descriptions for the narrative
const sceneDescriptions = [
  "Starbucks offers something for everyone—but some categories hide a LOT of sugar. Let’s start with a birds-eye view.",
  "Here are the worst offenders. How much sugar is lurking in your favorite drink?",
  "Now it’s your turn: filter and explore every drink to find healthier (or less healthy) options."
];

// Helper: map sugar level to color (traffic-light style)
function sugarColor(value) {
  if (value >= 50) return "#c42e3c";      // red – very high sugar
  if (value >= 30) return "#f4c430";      // orange – moderate sugar
  return "#00704a";                       // green – lower sugar
}

// Build / clear extra UI elements
function buildExtras(index, maxSugar) {
  const extras = d3.select("#extras").html("");
  if (index !== 2) return; // only needed for scene 3

  extras.append("label")
    .attr("for", "sugarSlider")
    .text("Minimum sugar (g):");

  extras.append("input")
    .attr("type", "range")
    .attr("id", "sugarSlider")
    .attr("min", 0)
    .attr("max", maxSugar)
    .attr("step", 5)
    .attr("value", 0);

  extras.append("span")
    .attr("id", "sliderVal")
    .style("font-weight", "bold")
    .text(" 0g");
}

// Initialize the visualization
document.addEventListener('DOMContentLoaded', function() {
  initializeChart();
  loadData();
});

function initializeChart() {
  svg = d3.select("#viz");
  width = +svg.attr("width");
  height = +svg.attr("height");
  margin = {top: 60, right: 80, bottom: 80, left: 120};
  
  // Create tooltip
  d3.select("body").append("div")
    .attr("class", "tooltip");
}

// Load and process data with retry logic
function loadData(retryCount = 0) {
  d3.csv("data.csv").then(function(csv) {
    data = csv.map(d => ({
      beverage: d.Beverage,
      category: d.Beverage_category,
      prep: d.Beverage_prep,
      calories: parseFloat(d.Calories) || 0,
      sugar: parseFloat(d["Sugars (g)"] || d[" Sugars (g)"] || 0),
      // Clean up category names
      cleanCategory: d.Beverage_category ? d.Beverage_category.replace(/™/g, '').trim() : 'Other'
    })).filter(d => d.calories > 0 && d.sugar >= 0); // Filter out invalid data
    
    console.log("Data loaded:", data.length, "items");
    // Show the current scene or default to scene 0
    showScene(currentScene);
  }).catch(error => {
    console.error("Error loading data:", error);
    if (retryCount < 3) {
      console.log(`Retrying data load... attempt ${retryCount + 1}`);
      setTimeout(() => loadData(retryCount + 1), 1000);
    } else {
      updateNarrativeText("Error loading data. Please check that data.csv is available and that you're running this on a web server.");
    }
  });
}

// Main scene switching function
function showScene(index) {
  if (!data) {
    console.log("Data not loaded yet");
    updateNarrativeText("Loading data, please wait...");
    // Try to load data again if user clicks a scene button
    loadData();
    return;
  }
  
  currentScene = index;
  
  // Update button states
  d3.selectAll("button").classed("active", false);
  d3.select(`#btn-${index}`).classed("active", true);
  
  // Clear previous chart
  svg.selectAll("*").remove();
  
  // Build dynamic extras (slider etc.)
  const maxSugar = d3.max(data, d => d.sugar);
  buildExtras(index, maxSugar);
  
  // Update narrative text
  updateNarrativeText(sceneDescriptions[index]);
  
  // Draw the appropriate scene
  switch(index) {
    case 0:
      drawCategoryOverview();
      break;
    case 1:
      drawSugarBombs();
      break;
    case 2:
      drawInteractiveExplore();
      break;
  }
}

function updateNarrativeText(text) {
  d3.select("#scene-description").text(text);
}

// Helper: add annotation group
function addAnnotations(annotations) {
  const makeAnnotations = d3.annotation()
    .type(d3.annotationLabel)
    .annotations(annotations);

  svg.append("g")
    .attr("class", "annotation-group")
    .call(makeAnnotations);
}

// Scene 1: Category Overview
function drawCategoryOverview() {
  const chartArea = {
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };
  
  // Calculate average sugar by category
  const avgSugar = d3.rollup(
    data,
    v => d3.mean(v, d => d.sugar),
    d => d.cleanCategory
  );
  
  const categoryData = Array.from(avgSugar, ([category, sugar]) => ({
    category: category,
    avgSugar: sugar
  })).sort((a, b) => b.avgSugar - a.avgSugar);
  
  // Create scales
  const x = d3.scaleBand()
    .domain(categoryData.map(d => d.category))
    .range([0, chartArea.width])
    .padding(0.3);
    
  const y = d3.scaleLinear()
    .domain([0, d3.max(categoryData, d => d.avgSugar)])
    .nice()
    .range([chartArea.height, 0]);
  
  // Create main group
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  // Add title
  svg.append("text")
    .attr("class", "chart-title")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .text("Average Sugar Content by Drink Category");
  
  // Create color scale
  const colorScale = d3.scaleSequential(d3.interpolateReds)
    .domain([0, d3.max(categoryData, d => d.avgSugar)]);
  
  // Draw bars
  g.selectAll("rect")
    .data(categoryData)
    .enter()
    .append("rect")
    .attr("x", d => x(d.category))
    .attr("y", chartArea.height)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", d => sugarColor(d.avgSugar))
    .attr("stroke", "#333")
    .attr("stroke-width", 1)
    .transition()
    .duration(1000)
    .attr("y", d => y(d.avgSugar))
    .attr("height", d => chartArea.height - y(d.avgSugar));
  
  // Add value labels on bars
  g.selectAll("text.bar-label")
    .data(categoryData)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.category) + x.bandwidth() / 2)
    .attr("y", d => y(d.avgSugar) - 5)
    .attr("text-anchor", "middle")
    .attr("opacity", 0)
    .text(d => `${d.avgSugar.toFixed(1)}g`)
    .transition()
    .delay(1000)
    .duration(500)
    .attr("opacity", 1);
  
  // Add axes
  g.append("g")
    .attr("transform", `translate(0,${chartArea.height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)");
  
  g.append("g")
    .call(d3.axisLeft(y));
  
  // Add axis labels
  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left + 20)
    .attr("x", 0 - (chartArea.height / 2))
    .attr("text-anchor", "middle")
    .text("Average Sugar (grams)");

  // after drawing bars and axes, before closing function, add annotation for most sugary category
  const mostSugary = categoryData[0];
  const annotations = [
    {
      note: {
        title: "Sugariest Category",
        label: `${mostSugary.category}: ${mostSugary.avgSugar.toFixed(1)}g avg sugar`
      },
      x: margin.left + x(mostSugary.category) + x.bandwidth() / 2,
      y: margin.top + y(mostSugary.avgSugar),
      dy: -40,
      dx: 0
    }
  ];
  addAnnotations(annotations);
}

// Scene 2: Sugar Bombs
function drawSugarBombs() {
  const chartArea = {
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };
  
  // Get top 10 highest sugar drinks
  const topSugar = data
    .sort((a, b) => b.sugar - a.sugar)
    .slice(0, 10);
  
  // Create scales
  const x = d3.scaleLinear()
    .domain([0, d3.max(topSugar, d => d.sugar)])
    .range([0, chartArea.width]);
    
  const y = d3.scaleBand()
    .domain(topSugar.map(d => `${d.beverage} (${d.prep})`))
    .range([0, chartArea.height])
    .padding(0.2);
  
  // Create main group
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  // Add title
  svg.append("text")
    .attr("class", "chart-title")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .text("Top 10 Sugar Bombs at Starbucks");
  
  // Create color scale
  const colorScale = d3.scaleSequential(d3.interpolateOrRd)
    .domain([d3.min(topSugar, d => d.sugar), d3.max(topSugar, d => d.sugar)]);
  
  // Draw bars
  g.selectAll("rect")
    .data(topSugar)
    .enter()
    .append("rect")
    .attr("x", 0)
    .attr("y", d => y(`${d.beverage} (${d.prep})`))
    .attr("width", 0)
    .attr("height", y.bandwidth())
    .attr("fill", d => sugarColor(d.sugar))
    .attr("stroke", "#333")
    .attr("stroke-width", 1)
    .transition()
    .duration(1500)
    .delay((d, i) => i * 100)
    .attr("width", d => x(d.sugar));
  
  // Add value labels
  g.selectAll("text.bar-label")
    .data(topSugar)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.sugar) + 5)
    .attr("y", d => y(`${d.beverage} (${d.prep})`) + y.bandwidth() / 2)
    .attr("alignment-baseline", "middle")
    .attr("opacity", 0)
    .text(d => `${d.sugar}g`)
    .transition()
    .delay(1500)
    .duration(500)
    .attr("opacity", 1);
  
  // Add y-axis
  g.append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "11px");
  
  // Add x-axis
  g.append("g")
    .attr("transform", `translate(0,${chartArea.height})`)
    .call(d3.axisBottom(x));
  
  // Add axis label
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", chartArea.width / 2)
    .attr("y", chartArea.height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .text("Sugar Content (grams)");

  // after drawing bars and axes, add annotation for highest sugar drink
  const highest = topSugar[0];
  const annotations = [
    {
      note: {
        title: "Top Sugar Bomb",
        label: `${highest.beverage} (${highest.prep})\n${highest.sugar}g sugar`
      },
      x: margin.left + x(highest.sugar),
      y: margin.top + y(`${highest.beverage} (${highest.prep})`) + y.bandwidth() / 2,
      dx: 30,
      dy: -30
    }
  ];
  addAnnotations(annotations);
}

// Scene 3: Interactive Exploration
function drawInteractiveExplore() {
  const chartArea = {
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };
  
  // Create scales
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.calories)])
    .range([0, chartArea.width]);
    
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sugar)])
    .range([chartArea.height, 0]);
  
  // Color scale by category
  const categories = [...new Set(data.map(d => d.cleanCategory))];
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(categories);
  
  // Create main group
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  // Add title
  svg.append("text")
    .attr("class", "chart-title")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .text("Calories vs Sugar: Explore All Starbucks Drinks");
  
  // Get tooltip
  const tooltip = d3.select(".tooltip");
  
  // Draw circles
  g.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.calories))
    .attr("cy", d => y(d.sugar))
    .attr("r", 0)
    .attr("fill", d => sugarColor(d.sugar))
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.7)
    .on("mouseover", function(event, d) {
      d3.select(this)
        .transition()
        .duration(100)
        .attr("r", 8)
        .attr("opacity", 1);
        
      tooltip.transition()
        .duration(200)
        .style("opacity", 1);
        
      tooltip.html(`
        <strong>${d.beverage}</strong><br/>
        ${d.prep}<br/>
        <em>${d.cleanCategory}</em><br/>
        Calories: ${d.calories}<br/>
        Sugar: ${d.sugar}g
      `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(d) {
      d3.select(this)
        .transition()
        .duration(100)
        .attr("r", 4)
        .attr("opacity", 0.7);
        
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    })
    .transition()
    .duration(1000)
    .delay((d, i) => i * 2)
    .attr("r", 4);
  
  // Add axes
  g.append("g")
    .attr("transform", `translate(0,${chartArea.height})`)
    .call(d3.axisBottom(x));
  
  g.append("g")
    .call(d3.axisLeft(y));
  
  // Add axis labels
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", chartArea.width / 2)
    .attr("y", chartArea.height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .text("Calories");
    
  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left + 20)
    .attr("x", 0 - (chartArea.height / 2))
    .attr("text-anchor", "middle")
    .text("Sugar (grams)");
  
  // Add legend
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - 160}, 60)`);

  const sugarLevels = [
    {label: "< 30g (Lower)", color: sugarColor(20)},
    {label: "30–49g (Moderate)", color: sugarColor(40)},
    {label: "≥ 50g (High)", color: sugarColor(60)}
  ];

  const legendItems = legend.selectAll(".legend-item")
    .data(sugarLevels)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`);

  legendItems.append("rect")
    .attr("x", 0)
    .attr("y", -5)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => d.color);

  legendItems.append("text")
    .attr("x", 18)
    .attr("y", 0)
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .text(d => d.label);

  // Slider interaction to filter by minimum sugar
  const slider = d3.select("#sugarSlider");
  if (!slider.empty()) {
    const updateScatter = (minSugar) => {
      d3.select("#sliderVal").text(` ${minSugar}g`);
      g.selectAll("circle")
        .attr("opacity", d => d.sugar >= minSugar ? 0.8 : 0.05)
        .attr("r", d => d.sugar >= minSugar ? 4 : 2);
    };
    slider.on("input", function() {
      updateScatter(+this.value);
    });
    // Initialize with current slider value
    updateScatter(+slider.property("value"));
  }

  // Identify drink with max sugar (could coincide with highest sugar bomb) to annotate
  const maxSugary = data.reduce((a, b) => (a.sugar > b.sugar ? a : b));
  const annotations = [
    {
      note: {
        title: "Highest Sugar Drink",
        label: `${maxSugary.beverage} (${maxSugary.sugar}g)`
      },
      x: margin.left + x(maxSugary.calories),
      y: margin.top + y(maxSugary.sugar),
      dx: 40,
      dy: -40
    }
  ];
  addAnnotations(annotations);
} 