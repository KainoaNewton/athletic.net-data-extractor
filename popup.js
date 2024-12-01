document.addEventListener('DOMContentLoaded', function () {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		const tab = tabs[0];

		if (
			tab.url.includes('athletic.net/CrossCountry/meet') ||
			tab.url.includes('athletic.net/TrackAndField/meet')
		) {
			document.getElementById('options').style.display = 'block';
			document.getElementById('error-message').style.display = 'none';

			// Execute content script first
			chrome.scripting
				.executeScript({
					target: { tabId: tab.id },
					files: ['contentScript.js'],
				})
				.then(() => {
					// Add event listeners after content script is injected
					document
						.getElementById('download-data')
						.addEventListener('click', downloadData);
					document
						.getElementById('copy-data')
						.addEventListener('click', copyToClipboard);
				})
				.catch((err) => {
					showMessage('Failed to initialize extension: ' + err.message, true);
				});
		} else {
			document.getElementById('error-message').style.display = 'block';
			document.getElementById('options').style.display = 'none';
			document.getElementById('error-message').textContent =
				'Please navigate to an Athletic.net meet results page.';
		}
	});
});

function showMessage(message, isError = false) {
	const messageElement = document.getElementById('error-message');
	messageElement.style.display = 'block';
	messageElement.style.color = isError ? '#e85f5c' : '#53ac7e';
	messageElement.style.backgroundColor = isError
		? 'var(--error-bg)'
		: 'var(--success-bg)';
	messageElement.style.border = `1px solid ${
		isError ? 'var(--error)' : 'var(--success)'
	}`;
	messageElement.textContent = message;

	// Close the popup after 500ms
	setTimeout(() => {
		window.close();
	}, 500);
}

function getMeetData() {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (!tabs[0]) {
				reject(new Error('No active tab found'));
				return;
			}

			chrome.tabs.sendMessage(
				tabs[0].id,
				{ action: 'getData' },
				function (response) {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
						return;
					}
					if (!response) {
						reject(new Error('No data received from the page'));
						return;
					}
					if (response.error) {
						reject(new Error(response.error));
						return;
					}
					resolve(response);
				}
			);
		});
	});
}

function formatTrackData(sections) {
	const rows = [];

	// Add main headers first
	rows.push(['Place', 'Name', 'School', 'Mark', 'Year', 'Wind']);

	sections.forEach((section) => {
		// Add section name
		rows.push([section.name]);

		// Add results
		section.results.forEach((row) => {
			rows.push([
				row.place || '',
				row.name || '',
				row.school || '',
				row.mark || '',

				row.year || '',
				row.wind ? row.wind.replace('m/s', '') : '', // Remove 'm/s' from wind values
			]);
		});
	});

	return rows;
}

function formatXCData(sections) {
	const rows = [];

	// Add headers
	rows.push(['Place', 'Name', 'School', 'Time', 'Year', 'Points']);

	sections.forEach((section) => {
		// For XC, we'll only use sections if they exist
		if (sections.length > 1) {
			rows.push([section.name]);
		}

		// Add results
		section.results.forEach((row) => {
			rows.push([
				row.place || '',
				row.name || '',
				row.school || '',
				row.time || '',
				row.year || '',
				row.points || '',
			]);
		});
	});

	return rows;
}

async function downloadData() {
	try {
		const button = document.getElementById('download-data');
		button.disabled = true;
		showMessage('Preparing download...');

		const response = await getMeetData();
		const rows =
			response.type === 'track'
				? formatTrackData(response.sections)
				: formatXCData(response.sections);

		const csvContent = rows
			.map((row) =>
				row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
			)
			.join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const meetType = response.type === 'track' ? 'track' : 'xc';
		a.download = `athletic_net_${meetType}_results_${
			new Date().toISOString().split('T')[0]
		}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		showMessage('Download complete!', false);
	} catch (error) {
		console.error('Download error:', error);

		showMessage(error.message || 'Failed to download data', true);
	} finally {
		document.getElementById('download-data').disabled = false;
	}
}

async function copyToClipboard() {
	try {
		const button = document.getElementById('copy-data');
		button.disabled = true;
		showMessage('Copying data...');

		const response = await getMeetData();
		const rows =
			response.type === 'track'
				? formatTrackData(response.sections)
				: formatXCData(response.sections);

		const tsvContent = rows
			.map((row) =>
				row.map((cell) => (cell || '').replace(/\t/g, ' ')).join('\t')
			)
			.join('\n');

		await navigator.clipboard.writeText(tsvContent);
		showMessage('Data copied to clipboard!', false);
	} catch (error) {
		console.error('Copy error:', error);
		showMessage(error.message || 'Failed to copy data', true);
	} finally {
		document.getElementById('copy-data').disabled = false;
	}
}
