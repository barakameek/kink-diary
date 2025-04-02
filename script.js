document.addEventListener('DOMContentLoaded', () => {
    const entryForm = document.getElementById('entryForm');
    const dataTableBody = document.getElementById('dataTableBody');
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Chart instances (to destroy before redrawing)
    let chartInstances = {};

    // --- Tab Navigation ---
    window.showTab = (tabId) => {
        tabs.forEach(button => button.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // Refresh analysis when tab is shown
        if (tabId === 'analysis') {
            runAnalysis();
        }
         if (tabId === 'view') {
            displayEntries(); // Refresh view in case of deletions
        }
    };

    // --- Local Storage Handling ---
    const STORAGE_KEY = 'personalTrackerData';

    const loadEntries = () => {
        const data = localStorage.getItem(STORAGE_KEY);
        // Ensure data is sorted by date ascending
        try {
            const entries = data ? JSON.parse(data) : [];
            return entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        } catch (error) {
            console.error("Error parsing localStorage data:", error);
            localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
            return [];
        }
    };

    const saveEntries = (entries) => {
        // Ensure data is sorted before saving
        const sortedEntries = entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedEntries));
    };

    // --- Data Display ---
    const displayEntries = () => {
        const entries = loadEntries();
        dataTableBody.innerHTML = ''; // Clear existing rows

        entries.forEach((entry, index) => {
            const row = dataTableBody.insertRow();
            row.innerHTML = `
                <td>${entry.date}</td>
                <td>${entry.totalActs ?? 0}</td>
                <td>${entry.partnersNum ?? 0}</td>
                <td>${entry.partnersList || '-'}</td>
                <td>${entry.masturbation ?? 0}</td>
                <td>${entry.selfOrgasms ?? 0}</td>
                <td>${entry.katCums ?? 0}</td>
                <td>${entry.analYN ? 'Yes' : 'No'}</td>
                <td>${entry.workoutYN ? 'Yes' : 'No'}</td>
                <td>${entry.workoutDetails || '-'}</td>
                <td>${entry.dateDinnerYN ? 'Yes' : 'No'}</td>
                <td>${entry.dateCost > 0 ? `$${entry.dateCost.toFixed(2)}` : '-'}</td>
                <td>${entry.notes || '-'}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
        });
         // Add delete listeners after rows are created
         addDeleteListeners();
    };

    // --- Delete Functionality ---
    const deleteEntry = (index) => {
        if (confirm('Are you sure you want to delete this entry?')) {
            const entries = loadEntries();
            entries.splice(index, 1); // Remove entry at the specified index
            saveEntries(entries);
            displayEntries(); // Refresh the table view
            // Optionally refresh analysis if the analysis tab is active
             if (document.getElementById('analysis').classList.contains('active')) {
                 runAnalysis();
             }
        }
    };

    const addDeleteListeners = () => {
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            // Remove existing listener to prevent duplicates if called multiple times
            button.replaceWith(button.cloneNode(true));
        });
        // Add new listeners
        document.querySelectorAll('.delete-btn').forEach(button => {
             button.addEventListener('click', (event) => {
                 const index = parseInt(event.target.getAttribute('data-index'), 10);
                 deleteEntry(index);
            });
        })

    };


    // --- Form Handling ---
    entryForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const newEntry = {
            // Assign a unique ID (timestamp + random for robustness)
            id: Date.now() + Math.random().toString(16).substring(2, 8),
            date: document.getElementById('date').value,
            totalActs: parseInt(document.getElementById('totalActs').value) || 0,
            partnersNum: parseInt(document.getElementById('partnersNum').value) || 0,
            masturbation: parseInt(document.getElementById('masturbation').value) || 0,
            katCums: parseInt(document.getElementById('katCums').value) || 0,
            selfOrgasms: parseInt(document.getElementById('selfOrgasms').value) || 0,
            analYN: document.getElementById('analYN').checked,
            workoutYN: document.getElementById('workoutYN').checked,
            dateDinnerYN: document.getElementById('dateDinnerYN').checked,
            dateCost: parseFloat(document.getElementById('dateCost').value) || 0,
            partnersList: document.getElementById('partnersList').value.trim(),
            workoutDetails: document.getElementById('workoutDetails').value.trim(),
            notes: document.getElementById('notes').value.trim(),
        };

        // Basic validation
        if (!newEntry.date) {
            alert("Please enter a date.");
            return;
        }

        const entries = loadEntries();
        entries.push(newEntry);
        saveEntries(entries);

        displayEntries(); // Update the table
        entryForm.reset(); // Clear the form
        document.getElementById('date').valueAsDate = new Date(); // Set date to today

        alert('Entry added successfully!');

        // Optionally switch to view tab or update analysis if open
        if (document.getElementById('analysis').classList.contains('active')) {
             runAnalysis();
        }
    });

    // --- Data Analysis ---
    const runAnalysis = () => {
        const entries = loadEntries();

        if (entries.length === 0) {
             // Clear stats and charts if no data
             clearAnalysisDisplay();
             return;
        }

        // 1. Calculate Summary Statistics
        let totalActs = 0;
        let totalMasturbation = 0;
        let totalSelfOrgasms = 0;
        let totalKatCums = 0;
        let daysAnal = 0;
        let daysWorkout = 0;
        let activeDaysCount = 0;
        let totalActsOnActiveDays = 0;
        const partnerCounts = {};
        const actsByDow = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        let workoutDayActs = 0;
        let workoutDays = 0;
        let nonWorkoutDayActs = 0;
        let nonWorkoutDays = 0;


        entries.forEach(entry => {
            const acts = entry.totalActs || 0;
            totalActs += acts;
            totalMasturbation += entry.masturbation || 0;
            totalSelfOrgasms += entry.selfOrgasms || 0;
            totalKatCums += entry.katCums || 0;
            if (entry.analYN) daysAnal++;
            if (entry.workoutYN) daysWorkout++;

            if (acts > 0) {
                activeDaysCount++;
                totalActsOnActiveDays += acts;
            }

             // Partner frequency
            if (entry.partnersList) {
                const partners = entry.partnersList.split(',').map(p => p.trim().toLowerCase()).filter(p => p);
                partners.forEach(partner => {
                    partnerCounts[partner] = (partnerCounts[partner] || 0) + 1;
                });
            }

            // Activity by Day of Week
             const entryDate = new Date(entry.date + 'T00:00:00'); // Ensure correct date parsing
             const dow = entryDate.getDay(); // 0 = Sunday, 6 = Saturday
             actsByDow[dow] += acts;

             // Workout vs Activity
             if (entry.workoutYN) {
                workoutDayActs += acts;
                workoutDays++;
             } else {
                nonWorkoutDayActs += acts;
                nonWorkoutDays++;
             }
        });

        const totalEntries = entries.length;
        const percAnal = totalEntries > 0 ? ((daysAnal / totalEntries) * 100).toFixed(1) : 0;
        const percWorkout = totalEntries > 0 ? ((daysWorkout / totalEntries) * 100).toFixed(1) : 0;
        const avgActsPerActiveDay = activeDaysCount > 0 ? (totalActsOnActiveDays / activeDaysCount).toFixed(1) : 0;

        // Find most frequent partner(s)
        let maxCount = 0;
        let mostFrequentPartners = [];
        for (const partner in partnerCounts) {
            if (partnerCounts[partner] > maxCount) {
                maxCount = partnerCounts[partner];
                mostFrequentPartners = [partner];
            } else if (partnerCounts[partner] === maxCount) {
                mostFrequentPartners.push(partner);
            }
        }

        // Update Summary Stats Display
        document.getElementById('statTotalEntries').textContent = totalEntries;
        document.getElementById('statTotalActs').textContent = totalActs;
        document.getElementById('statTotalMasturbation').textContent = totalMasturbation;
        document.getElementById('statTotalSelfOrgasms').textContent = totalSelfOrgasms;
        document.getElementById('statTotalKatOrgasms').textContent = totalKatCums;
        document.getElementById('statDaysAnal').textContent = daysAnal;
        document.getElementById('statPercAnal').textContent = percAnal;
        document.getElementById('statDaysWorkout').textContent = daysWorkout;
        document.getElementById('statPercWorkout').textContent = percWorkout;
        document.getElementById('statAvgActsPerActiveDay').textContent = avgActsPerActiveDay;
        document.getElementById('statMostFrequentPartner').textContent = mostFrequentPartners.length > 0 ? mostFrequentPartners.join(', ') + ` (${maxCount} times)` : '-';


        // 2. Prepare and Render Charts
        renderCharts(entries, partnerCounts, actsByDow, workoutDayActs, workoutDays, nonWorkoutDayActs, nonWorkoutDays);
    };

     const clearAnalysisDisplay = () => {
         // Clear Stats
        document.getElementById('statTotalEntries').textContent = 0;
        document.getElementById('statTotalActs').textContent = 0;
        document.getElementById('statTotalMasturbation').textContent = 0;
        document.getElementById('statTotalSelfOrgasms').textContent = 0;
        document.getElementById('statTotalKatOrgasms').textContent = 0;
        document.getElementById('statDaysAnal').textContent = 0;
        document.getElementById('statPercAnal').textContent = 0;
        document.getElementById('statDaysWorkout').textContent = 0;
        document.getElementById('statPercWorkout').textContent = 0;
        document.getElementById('statAvgActsPerActiveDay').textContent = 0.0;
        document.getElementById('statMostFrequentPartner').textContent = '-';

        // Destroy existing charts
        Object.values(chartInstances).forEach(chart => chart?.destroy());
        chartInstances = {};
    };


    const renderCharts = (entries, partnerCounts, actsByDow, workoutDayActs, workoutDays, nonWorkoutDayActs, nonWorkoutDays) => {
        // Destroy previous charts to prevent memory leaks and rendering issues
        Object.values(chartInstances).forEach(chart => chart?.destroy());
        chartInstances = {};

        // --- Chart 1: Acts Over Time ---
        const actsCtx = document.getElementById('actsOverTimeChart').getContext('2d');
        chartInstances.actsOverTime = new Chart(actsCtx, {
            type: 'line',
            data: {
                // Use date for labels directly if using time scale
                 datasets: [{
                    label: 'Total Acts per Day',
                    data: entries.map(entry => ({ x: entry.date, y: entry.totalActs ?? 0 })),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                 },
                // Optional: Add Masturbation or other series
                 {
                    label: 'Masturbation Count',
                    data: entries.map(entry => ({ x: entry.date, y: entry.masturbation ?? 0 })),
                    borderColor: 'rgb(255, 99, 132)',
                     borderDash: [5, 5], // Dashed line
                    tension: 0.1,
                    fill: false,
                    hidden: true // Initially hidden
                 }
                ]
            },
            options: {
                scales: {
                    x: {
                        type: 'time',
                        time: {
                             unit: 'month', // Adjust unit based on data range (day, week, month)
                             tooltipFormat: 'PPP' // e.g., Jan 1, 2024
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    }
                },
                 plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                 }
            }
        });

        // --- Chart 2: Partner Frequency ---
        const partnerLabels = Object.keys(partnerCounts);
        const partnerData = Object.values(partnerCounts);
        const partnerCtx = document.getElementById('partnerFrequencyChart').getContext('2d');
         // Sort partners by frequency for better visualization
         const sortedPartners = partnerLabels.map((label, index) => ({ label, count: partnerData[index] }))
                                         .sort((a, b) => b.count - a.count);

        chartInstances.partnerFrequency = new Chart(partnerCtx, {
            type: 'bar',
            data: {
                labels: sortedPartners.map(p => p.label), // Use sorted labels
                datasets: [{
                    label: 'Number of Days Logged',
                    data: sortedPartners.map(p => p.count), // Use sorted data
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Makes it a horizontal bar chart if many partners
                scales: {
                    x: {
                        beginAtZero: true,
                         title: { display: true, text: 'Number of Days Present in Log'}
                    },
                     y: {
                         ticks: { autoSkip: false } // Prevent labels skipping if too many
                    }
                },
                 plugins: {
                     legend: { display: false } // Hide legend if label is clear
                 }
            }
        });

        // --- Chart 3: Activity by Day of Week ---
        const dowCtx = document.getElementById('activityByDowChart').getContext('2d');
        chartInstances.activityByDow = new Chart(dowCtx, {
            type: 'bar',
            data: {
                labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                datasets: [{
                    label: 'Total Acts',
                    data: actsByDow,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)',
                        'rgba(255, 159, 64, 0.6)',
                        'rgba(199, 199, 199, 0.6)'
                    ],
                    borderColor: [
                         'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                         title: { display: true, text: 'Total Sexual Acts Logged'}
                    }
                },
                 plugins: {
                     legend: { display: false }
                 }
            }
        });

         // --- Chart 4: Workout vs Non-Workout Day Activity ---
        const workoutVsCtx = document.getElementById('workoutVsActivityChart').getContext('2d');
        const avgActsWorkoutDay = workoutDays > 0 ? (workoutDayActs / workoutDays) : 0;
        const avgActsNonWorkoutDay = nonWorkoutDays > 0 ? (nonWorkoutDayActs / nonWorkoutDays) : 0;

        chartInstances.workoutVsActivity = new Chart(workoutVsCtx, {
            type: 'bar',
            data: {
                labels: ['Workout Days', 'Non-Workout Days'],
                datasets: [{
                    label: 'Average Sexual Acts',
                    data: [avgActsWorkoutDay, avgActsNonWorkoutDay],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(255, 159, 64, 0.6)'
                    ],
                    borderColor: [
                         'rgba(75, 192, 192, 1)',
                         'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                         title: { display: true, text: 'Average Acts per Day'}
                    }
                },
                 plugins: {
                     legend: { display: false }
                 }
            }
        });

    };

     // --- Import/Export ---
     const exportBtn = document.getElementById('exportBtn');
     const importBtn = document.getElementById('importBtn');
     const importFile = document.getElementById('importFile');

     exportBtn.addEventListener('click', () => {
         const entries = loadEntries();
         if (entries.length === 0) {
             alert('No data to export.');
             return;
         }
         const jsonData = JSON.stringify(entries, null, 2); // Pretty print JSON
         const blob = new Blob([jsonData], { type: 'application/json' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
         a.href = url;
         a.download = `personal_tracker_backup_${timestamp}.json`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
         alert('Data exported successfully!');
     });

     importBtn.addEventListener('click', () => {
         importFile.click(); // Trigger file input click
     });

     importFile.addEventListener('change', (event) => {
         const file = event.target.files[0];
         if (!file) {
             return;
         }
         const reader = new FileReader();
         reader.onload = (e) => {
             try {
                 const importedData = JSON.parse(e.target.result);
                 if (!Array.isArray(importedData)) {
                     throw new Error('Imported data is not a valid array.');
                 }
                 // Optional: Basic validation of imported objects
                 // e.g., check if items have a 'date' property
                 const hasDates = importedData.every(item => item && item.date);
                 if (!hasDates) {
                     throw new Error('Imported data seems invalid (missing dates).');
                 }

                 if (confirm(`Import ${importedData.length} entries? This will REPLACE existing data.`)) {
                     saveEntries(importedData); // Replace existing data
                     displayEntries();
                      if (document.getElementById('analysis').classList.contains('active')) {
                        runAnalysis();
                     }
                     alert('Data imported successfully!');
                 }
             } catch (error) {
                 console.error('Import Error:', error);
                 alert(`Failed to import data: ${error.message}`);
             } finally {
                 // Reset file input to allow importing the same file again if needed
                 importFile.value = null;
             }
         };
         reader.onerror = () => {
            alert('Error reading file.');
            importFile.value = null;
         }
         reader.readAsText(file);
     });


    // --- Initial Load ---
    document.getElementById('date').valueAsDate = new Date(); // Set default date to today
    displayEntries(); // Load and display data on page load
    // runAnalysis(); // Initial analysis run (optional, can wait until tab is clicked)

}); // End DOMContentLoaded
