import { describe, expect, test } from '@jest/globals';
import { matchTimers, buildTimerUrl, formatTimerButtonText } from './timers';

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

describe('formatting timer button text', () => {
    test('formats minutes without label', () => {
        expect(formatTimerButtonText('30', null)).toBe('⏱ 30 Min');
    });

    test('formats minutes with label', () => {
        expect(formatTimerButtonText('30', 'Teig ruhen')).toBe('⏱ 30 Min (Teig ruhen)');
    });
});
