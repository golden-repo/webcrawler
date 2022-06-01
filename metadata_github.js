module.exports = {
    pages: [
        {
            id: 1,
            name: 'login',
            actions: [
                {
                    name: 'login',
                    type: 'authentication',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#login_field',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'himadri-repo',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 2,
                            controlid: '',
                            selector: '#password',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'hm28011975',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 3,
                            controlid: '',
                            selector: '#login > form > div.auth-form-body.mt-3 > input.btn.btn-primary.btn-block',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            checkselector: '#dashboard > div.dashboard-sidebar.column.one-third.pr-5.pt-3 > div > div.Box-body > ul > li:nth-child(2) > div > a'
                        }                        
                    ]
                }
            ]
        },
        {
            id: 2,
            name: 'github.com',
            actions: [
                {
                    name: 'github.com',
                    type: 'homepage',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#dashboard > div.dashboard-sidebar.column.one-third.pr-5.pt-3 > div.Box.Box--condensed.mb-3.js-repos-container > div.Box-body > ul > li:nth-child(1) > a',
                            checkcontent: '',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: '#js-repo-pjax-container > div.container.new-discussion-timeline.experiment-repo-nav > div.repository-content > div.file-navigation.in-mid-page.d-flex.flex-items-start > details > summary'
                        }
                    ]
                }
            ]
        },
        {
            id: 3,
            name: 'webscraping',
            actions: [
                {
                    name: 'webscraping',
                    type: 'code',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '.js-navigation-open',
                            checkcontent: 'README.md',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: '#js-repo-pjax-container > div.container.new-discussion-timeline.experiment-repo-nav > div.repository-content > div.file > div.file-header > div.file-actions > form.inline-form.js-update-url-with-hash > button'
                        }
                    ]
                }
            ]
        },
        {
            id: 4,
            name: 'README',
            actions: [
                {
                    name: 'README',
                    type: 'singlefilecode',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#js-repo-pjax-container > div.container.new-discussion-timeline.experiment-repo-nav > div.repository-content > div.file > div.file-header > div.file-actions > form.inline-form.js-update-url-with-hash > button',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            checkselector: '#new_blob > div.file.js-code-editor.container-preview.show-code > div.file-header > nav > button.btn-link.code.selected.tabnav-tab.js-blob-edit-code.js-blob-edit-tab'
                        }
                    ]
                }
            ]
        },
        {
            id: 5,
            name: 'README',
            actions: [
                {
                    name: 'README',
                    type: 'singlefilecode',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#new_blob > div.file.js-code-editor.container-preview.show-code > div.file-header > nav > button.btn-link.code.selected.tabnav-tab.js-blob-edit-code.js-blob-edit-tab',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            checkselector: '#new_blob > div.file.js-code-editor.container-preview.show-code > div.commit-create > div > div.CodeMirror-scroll > div.CodeMirror-sizer > div > div > div'
                        },
                        {
                            id: 2,
                            controlid: '',
                            selector: '#new_blob > div.file.js-code-editor.container-preview.show-code > div.commit-create > div > div.CodeMirror-scroll > div.CodeMirror-sizer > div > div > div',
                            checkcontent: '',
                            type: 'textbox',
                            value: {
                                eventtype:'keydown',
                                keys: ["Control^down", "End^down", "Control^up", "Enter^down", "Enter^down"],
                                delay: 50
                            },
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 3,
                            controlid: '',
                            selector: '',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'Hi! this is automated text. Entered by puppeteer.',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 4,
                            controlid: '',
                            selector: '#submit-file',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            checkselector: '#js-repo-pjax-container > div.container.new-discussion-timeline.experiment-repo-nav > div.repository-content > div.file > div.file-header > div.file-actions > form.inline-form.js-update-url-with-hash > button'
                        }
                    ]
                }
            ]
        }
    ]
};