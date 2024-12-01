function cleanValue(value) {
	if (!value || value.trim() === '--') return '';
	return value.trim();
}

function extractMeetData() {
	try {
		const url = window.location.href;
		const isTrackMeet = url.includes('/TrackAndField/meet');
		const isCrossMeet = url.includes('/CrossCountry/meet');

		if (!isTrackMeet && !isCrossMeet) {
			throw new Error(
				'Please navigate to a Track & Field or Cross Country meet results page.'
			);
		}

		// Find section headers (Finals, Prelims, etc.)
		const sections = [];
		let currentSection = null;

		// Find all h5 headers and their following result grids
		document.querySelectorAll('h5').forEach((header) => {
			// Remove any buttons before getting the text
			const headerText = header.cloneNode(true);
			headerText.querySelectorAll('button').forEach((btn) => btn.remove());
			const sectionName = headerText.textContent.trim();

			if (sectionName) {
				// Find the closest result grid after this header
				const resultGrid = header
					.closest('.mb-4')
					?.querySelector('shared-result-grid');
				if (resultGrid) {
					currentSection = {
						name: sectionName,
						results: [],
					};
					sections.push(currentSection);

					// Process all rows in this section
					resultGrid.querySelectorAll('.result-row').forEach((row) => {
						try {
							const place = cleanValue(
								row.querySelector('.place-column')?.textContent
							);
							const nameElement = row.querySelector(
								'.primary .title a[href*="/athlete/"]'
							);
							const name = cleanValue(nameElement?.textContent);
							const schoolElement = row.querySelector(
								'.subtitle.team .text-overflow-ellipsis a'
							);
							const school = cleanValue(schoolElement?.textContent);
							const timeElement = row.querySelector('.secondary .title a');
							const time = cleanValue(timeElement?.textContent);
							const tertiaryElement = row.querySelector(
								'shared-tertiary-stats'
							);
							const tertiaryText =
								cleanValue(tertiaryElement?.textContent) || '';

							if (isTrackMeet) {
								const yearMatch = tertiaryText.match(/Yr: (\d+)/);
								const windMatch = tertiaryText.match(/([-+]?\d+\.?\d*)m\/s/);
								const year = yearMatch ? yearMatch[1] : '';
								const wind = windMatch ? windMatch[1] : '';

								if (place !== undefined || name) {
									currentSection.results.push({
										place,
										name,
										school: school || '',
										mark: time || '',
										year,
										wind,
									});
								}
							} else {
								const yearMatch = tertiaryText.match(/Yr: (\d+)/);
								const pointsMatch = tertiaryText.match(/\+(\d+)pts/);
								const year = yearMatch ? yearMatch[1] : '';
								const points = pointsMatch ? pointsMatch[1] : '';

								if (place !== undefined || name) {
									currentSection.results.push({
										place,
										name,
										school: school || '',
										time: time || '',
										year,
										points,
									});
								}
							}
						} catch (rowError) {
							console.error('Error processing row:', rowError);
						}
					});
				}
			}
		});

		if (sections.length === 0) {
			const defaultResults = [];
			document.querySelectorAll('.result-row').forEach((row) => {
				try {
					const place = cleanValue(
						row.querySelector('.place-column')?.textContent
					);
					const nameElement = row.querySelector(
						'.primary .title a[href*="/athlete/"]'
					);
					const name = cleanValue(nameElement?.textContent);
					const schoolElement = row.querySelector(
						'.subtitle.team .text-overflow-ellipsis a'
					);
					const school = cleanValue(schoolElement?.textContent);
					const timeElement = row.querySelector('.secondary .title a');
					const time = cleanValue(timeElement?.textContent);
					const tertiaryElement = row.querySelector('shared-tertiary-stats');
					const tertiaryText = cleanValue(tertiaryElement?.textContent) || '';

					if (isTrackMeet) {
						const yearMatch = tertiaryText.match(/Yr: (\d+)/);
						const windMatch = tertiaryText.match(/([-+]?\d+\.?\d*)m\/s/);
						const year = yearMatch ? yearMatch[1] : '';
						const wind = windMatch ? windMatch[1] : '';

						if (place !== undefined || name) {
							defaultResults.push({
								place,
								name,
								school: school || '',
								mark: time || '',
								year,
								wind,
							});
						}
					} else {
						const yearMatch = tertiaryText.match(/Yr: (\d+)/);
						const pointsMatch = tertiaryText.match(/\+(\d+)pts/);
						const year = yearMatch ? yearMatch[1] : '';
						const points = pointsMatch ? pointsMatch[1] : '';

						if (place !== undefined || name) {
							defaultResults.push({
								place,
								name,
								school: school || '',
								time: time || '',
								year,
								points,
							});
						}
					}
				} catch (rowError) {
					console.error('Error processing row:', rowError);
				}
			});

			if (defaultResults.length > 0) {
				sections.push({
					name: 'Results',
					results: defaultResults,
				});
			}
		}

		if (
			sections.length === 0 ||
			sections.every((section) => section.results.length === 0)
		) {
			throw new Error('No results found on this page');
		}

		return {
			type: isTrackMeet ? 'track' : 'xc',
			sections: sections,
		};
	} catch (error) {
		console.error('Data extraction error:', error);
		throw error;
	}
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'getData') {
		try {
			const data = extractMeetData();
			sendResponse(data);
		} catch (error) {
			sendResponse({ error: error.message });
		}
	}
	return true;
});
