import { describe, expect, test } from '@jest/globals';
import {
    matchTimers,
    matchIngredientTags,
    extractMarkedIngredientsFromText,
    sortHighlightIngredients,
    matchHighlightedIngredientsInStep,
    buildTimerUrl,
    formatTimerButtonText,
    formatDurationText,
    parseDurationToMinutes,
    parseFrontmatterTimeMinutes,
    calculateTotalTimerMinutes,
    formatDuration,
} from './timers';

describe('matching @timer{...} syntax', () => {
    test('matches timer with minutes only', () => {
        expect(matchTimers('Backe für @timer{15} im Ofen.')).toStrictEqual([
            {
                index: 10,
                length: 10,
                minutes: '15',
                label: null,
            },
        ]);
    });

    test('matches timer with minutes and label', () => {
        expect(matchTimers('Lasse den Teig @timer{30|Teig ruhen} stehen.')).toStrictEqual([
            {
                index: 15,
                length: 21,
                minutes: '30',
                label: 'Teig ruhen',
            },
        ]);
    });

    test('matches multiple timers in a single step', () => {
        expect(
            matchTimers('Erst @timer{10|Anbraten}, dann @timer{25 | Köcheln lassen}.')
        ).toStrictEqual([
            {
                index: 5,
                length: 19,
                minutes: '10',
                label: 'Anbraten',
            },
            {
                index: 31,
                length: 27,
                minutes: '25',
                label: 'Köcheln lassen',
            },
        ]);
    });
});

describe('building timer URLs', () => {
    test('builds default iOS shortcut URL without label', () => {
        expect(buildTimerUrl('30', null, 'StartTimer')).toBe(
            'shortcuts://run-shortcut?name=StartTimer&input=text&text=30'
        );
    });

    test('builds default iOS shortcut URL with URL-encoded label', () => {
        expect(buildTimerUrl('30', 'Teig ruhen', 'StartTimer')).toBe(
            'shortcuts://run-shortcut?name=StartTimer&input=text&text=30|Teig%20ruhen'
        );
    });

    test('retains exact numeric minutes in URL even for >= 60 minutes', () => {
        expect(buildTimerUrl('120', 'Schmoren', 'StartTimer')).toBe(
            'shortcuts://run-shortcut?name=StartTimer&input=text&text=120|Schmoren'
        );
        expect(buildTimerUrl('90', null, 'StartTimer')).toBe(
            'shortcuts://run-shortcut?name=StartTimer&input=text&text=90'
        );
    });

    test('supports custom shortcut name and custom URL template', () => {
        expect(
            buildTimerUrl(
                '45',
                'Brot backen',
                'My Timer',
                'shortcuts://run-shortcut?name=<SHORTCUT_NAME>&input=text&text=<MINUTEN>[|<URL_ENCODED_LABEL>]'
            )
        ).toBe(
            'shortcuts://run-shortcut?name=My%20Timer&input=text&text=45|Brot%20backen'
        );

        expect(
            buildTimerUrl(
                '45',
                null,
                'My Timer',
                'shortcuts://run-shortcut?name=<SHORTCUT_NAME>&input=text&text=<MINUTEN>[|<URL_ENCODED_LABEL>]'
            )
        ).toBe('shortcuts://run-shortcut?name=My%20Timer&input=text&text=45');
    });
});

describe('formatting timer button text & smart durations', () => {
    test('formats durations under 60 minutes unchanged', () => {
        expect(formatTimerButtonText('30', null)).toBe('⏱ 30 Min');
        expect(formatTimerButtonText('30', 'Teig ruhen')).toBe('⏱ 30 Min (Teig ruhen)');
        expect(formatTimerButtonText('45', null, 'en')).toBe('⏱ 45 min');
        expect(formatTimerButtonText('10', null, 'compact')).toBe('⏱ 10m');
    });

    test('formats exact hours >= 60 minutes', () => {
        expect(formatTimerButtonText('60', null, 'de')).toBe('⏱ 1 Std.');
        expect(formatTimerButtonText('120', 'Gehen lassen', 'de')).toBe(
            '⏱ 2 Std. (Gehen lassen)'
        );
        expect(formatTimerButtonText('60', null, 'en')).toBe('⏱ 1 hr');
        expect(formatTimerButtonText('120', null, 'en')).toBe('⏱ 2 hrs');
        expect(formatTimerButtonText('120', null, 'compact')).toBe('⏱ 2h');
    });

    test('formats mixed hours and minutes >= 60 minutes', () => {
        expect(formatTimerButtonText('90', null, 'de')).toBe('⏱ 1 Std. 30 Min');
        expect(formatTimerButtonText('90', 'Ruhen', 'de')).toBe('⏱ 1 Std. 30 Min (Ruhen)');
        expect(formatTimerButtonText('90', null, 'en')).toBe('⏱ 1 hr 30 min');
        expect(formatTimerButtonText('150', null, 'en')).toBe('⏱ 2 hrs 30 min');
        expect(formatTimerButtonText('90', null, 'compact')).toBe('⏱ 1h 30m');
        expect(formatDurationText('90', 'minutes')).toBe('90 Min');
    });
});

describe('parsing durations with units and summing total timer minutes', () => {
    test('parses plain minutes and unit strings into minutes', () => {
        expect(parseDurationToMinutes('15')).toBe(15);
        expect(parseDurationToMinutes('25 min')).toBe(25);
        expect(parseDurationToMinutes('1.5 h')).toBe(90);
        expect(parseDurationToMinutes('1h 15m')).toBe(75);
        expect(parseDurationToMinutes('2 Std')).toBe(120);
        expect(parseDurationToMinutes('90s')).toBe(1.5);
    });

    test('parses frontmatter time properties', () => {
        expect(parseFrontmatterTimeMinutes(20)).toBe(20);
        expect(parseFrontmatterTimeMinutes('20 Min')).toBe(20);
        expect(parseFrontmatterTimeMinutes('1 Std. 15 Min')).toBe(75);
        expect(parseFrontmatterTimeMinutes(null)).toBe(0);
    });

    test('calculates total timer minutes across recipe text while ignoring frontmatter and code blocks', () => {
        const recipeText = `---
type: rezept
note: "@timer{999}"
---
1. Zwiebeln @timer{5|Anbraten} dünsten.
2. Brühe zugeben und @timer{20 min|Köcheln} lassen (Beispiel \`@timer{100}\`).
3. Im Ofen @timer{1h 10m|Überbacken}.
        `;
        expect(calculateTotalTimerMinutes(recipeText)).toBe(95);
    });

    test('formats summed numeric duration via formatDuration', () => {
        expect(formatDuration(45)).toBe('45 Min');
        expect(formatDuration(60)).toBe('1 Std.');
        expect(formatDuration(75)).toBe('1 Std. 15 Min');
        expect(formatDuration(75, 'en')).toBe('1 hr 15 min');
    });
});

describe('ingredient list marker extraction and automatic step highlighting', () => {
    test('extracts @Zutat and @{Mehrwort Zutat} from ingredient lines and strips @ and {}', () => {
        expect(extractMarkedIngredientsFromText('250 g @Butter')).toStrictEqual({
            cleanedText: '250 g Butter',
            extracted: ['Butter'],
        });

        expect(extractMarkedIngredientsFromText('150 g @{brauner Zucker}')).toStrictEqual({
            cleanedText: '150 g brauner Zucker',
            extracted: ['brauner Zucker'],
        });

        expect(
            extractMarkedIngredientsFromText('2 EL @Olivenöl (extra vergine)')
        ).toStrictEqual({
            cleanedText: '2 EL Olivenöl (extra vergine)',
            extracted: ['Olivenöl'],
        });
    });

    test('excludes @timer directives and email addresses', () => {
        expect(
            matchIngredientTags(
                'Gib @Butter hinzu und lasse es @timer{15|Köcheln} oder @timer ziehen (kontakt@example.com).'
            )
        ).toStrictEqual([
            { index: 4, length: 7, name: 'Butter' },
        ]);
    });

    test('sorts extracted highlightIngredients descending by length and deduplicates case-insensitively', () => {
        expect(
            sortHighlightIngredients(['Mehl', 'Zucker', 'brauner Zucker', 'zucker'])
        ).toStrictEqual(['brauner Zucker', 'Zucker', 'Mehl']);
    });

    test('automatically matches extracted ingredient keywords in plain step text respecting word boundaries and longer terms first', () => {
        const keywords = ['Zucker', 'brauner Zucker', 'Butter', 'Olivenöl'];
        const stepText =
            'Schmelze die Butter, rühre brauner Zucker sowie restlichen Zucker und etwas Olivenöl unter (keine Buttermilch).';
        expect(matchHighlightedIngredientsInStep(stepText, keywords)).toStrictEqual([
            { index: 13, length: 6, name: 'Butter' },
            { index: 27, length: 14, name: 'brauner Zucker' },
            { index: 59, length: 6, name: 'Zucker' },
            { index: 76, length: 8, name: 'Olivenöl' },
        ]);
    });
});

