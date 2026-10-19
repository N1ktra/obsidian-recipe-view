module.exports = {
    Component: class Component {
        load() {}
        unload() {}
        registerEvent() {}
        registerDomEvent() {}
    },
    MarkdownRenderer: {
        renderMarkdown: () => Promise.resolve(),
    },
    TFile: class TFile {},
};
