function writable(initialValue) {
    let value = initialValue;
    let subscribers = [];
    return {
        subscribe(fn) {
            subscribers.push(fn);
            fn(value);
            return () => {
                subscribers = subscribers.filter((s) => s !== fn);
            };
        },
        set(newValue) {
            value = newValue;
            subscribers.forEach((fn) => fn(value));
        },
        update(fn) {
            this.set(fn(value));
        },
    };
}

function get(store) {
    let val;
    store.subscribe((v) => (val = v))();
    return val;
}

module.exports = {
    writable,
    get,
};
