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
    Platform: {
        isDesktop: true,
        isMobile: false,
        isPhone: false,
        isTablet: false,
    },
};
