const { formatQuantity } = require('../src/quantities');

module.exports = class MockSvelteComponent {
    constructor(options) {
        if (options && options.target && options.props) {
            const { value, format, unit, qtyScaleStore } = options.props;
            if (value != null && format != null) {
                const render = (scale = 1) => {
                    const scaleNum = typeof scale?.valueOf === 'function' ? scale.valueOf() : (scale || 1);
                    const formatted = typeof formatQuantity === 'function'
                        ? formatQuantity(value, format, scale, false)
                        : (value * scaleNum).toString();
                    options.target.innerHTML = `<span class="scale-number">${formatted}</span>${unit ? `<span class="scale-unit">&nbsp;${unit}</span>` : ''}`;
                };
                if (qtyScaleStore && typeof qtyScaleStore.subscribe === 'function') {
                    qtyScaleStore.subscribe((s) => {
                        render(s);
                    });
                } else {
                    render(1);
                }
            }
        }
    }
    $set() {}
    $on() {}
    $destroy() {}
};
