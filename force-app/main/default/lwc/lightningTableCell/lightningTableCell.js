/**
 * Created by ryan on 2020/8/13.
 */

import { api, track } from 'lwc';
import Utils from 'c/utils';
import CellAdapter from './cellAdapter';
import Table from 'c/table';
import LifecycleElement from 'c/lifecycleElement';
import Helper from './helper';
import LocalCacheService from 'c/localCacheService';
import { parseFuncParams } from './utils';


export default class LightningTableCell extends LifecycleElement {

    keyField = '_id';
    field = '';
    fieldValue = '';
    displayField = '';
    displayValue = '';
    dataType = '';
    type = '';
    align = 'left';
    realValue = undefined;
    referenceAPI = '';
    rowIdentity = '';
    spanStyle = '';
    title = '';
    url = '';
    urlValue = '';
    noneUrlValue = '';
    value = '';
    cellType = '';
    // cellHashcode = '';
    // rowsHashcode = '';

    textStyle = '';

    percentFixed = false;
    alwaysEditing = false;
    autoSave = false;

    avatarUrl = false;

    editable = false;

    cIndex = undefined;
    index = undefined;

    usingUrl = false;
    hasAvatar = false;
    hasTip = false;
    hasSaveButton = false;
    hasTitle = false;
    hasPopover = false;

    hoverClass = '';
    hoverStyle = '';

    isCustomized = false;

    @track customizedInfo = {};

    //

    isEdit = false;
    isBoolean = false;
    isStandard = false;
    hasCellInit = false;

    infectedByRows = false;
    deployContainer;

    reactiveValueFields = ['rows'];

    @api set cell(cell) {
        this._cell = cell;
        this.initByCell().catch(e => console.log(e));
    }

    get cell() {
        return this._cell || {};
    }

    @track
    extra = {};


    @track
    actions = [];

    @track
    button = {
        is: false,
        variant: '',
        disabled: false

    };

    @track
    popover = {
        bodyLines: [{
            key: '',
            line: ''
        }],
        className: '',
        title: ''
    };

    @track
    editor = {
        isOuter: false,
        className: '',
        picklistOptions: [],
        textareaExpand: false,
        referenceAPI: '',
        helperText: '',
        hasHelperText: false
    };

    @track
    tip = {
        content: '',
        icon: 'utility:info',
        variant: 'bare',
        isCustom: false,
        position: {
            isAppend: false,
            isInsertBefore: false,
            isStart: false,
            isEnd: false
        }
    };

    @track
    tree = {
        isTreeHeader: false,
        parentName: '',
        isExpand: false,
        canExpand: false,
        // all following is auto computed, do not assigning value.
        isRoot: true,
        isShow: true,
        indent: 0,
        childrenNum: 0,
        hasChildren: false,
        hasParent: false,
        showExpand: true,
        parentNode: undefined,
        rootParent: undefined,
        childNodes: undefined,
        treeIcon: '',
        paddingLeft: ''
    };

    @track
    editIconPosition = {
        isAppend: false,
        isInsertBefore: false,
        isStart: false,
        isEnd: false
    };

    get editorClass() {
        return Utils.generateClassName(
            this.editor.className,
            this.extra.isFocus ? 'is-focus' : ''
        );
    }

    getKeyRows() {
        const { cell } = this;
        this.infectedByRows = true;
        return cell.getKeyRows();
    }

    getThisRow() {
        return this.row || this.cell.getThisRow(this.cell.rowIdentity) || {};
    }

    applyChanges() {
        const { cell } = this;
        const { keyField } = cell;
        return new Promise((resolve, reject) => {
            const id = Utils.genID(7);
            const label = 'cell computed ' + id;
            // console.time(label);
            CellAdapter.adaptProperty(this, cell, {
                [keyField]: keyField
            });
            Object.keys(this.tree).forEach(
                key => {
                    if (key in cell) {
                        this.tree[key] = cell[key];
                    }
                }
            );
            this.parseCellConfigs();
            this.sendParents('cellInitialed', {
                get: (propertyName) => {
                    if (propertyName) {
                        const result = this[propertyName];
                        if (typeof result === 'function') {
                            return result.bind(this);
                        }
                        return result;
                    }
                    return null;
                }
            });
            if (this.alwaysEditing) {
                if (!this.isEdit) {
                    this.$nextTick(() => {
                        // execute onEdit method.
                        this.beforeEdit({ preventFocus: true });
                        return true;
                    });
                } else {
                    this.beforeEdit({ preventFocus: true });
                }
            } else if (this.isAlwaysEditingChanged) {
                if (this.isEdit) {
                    this.$nextTick(() => {
                        // execute cancelEdit method.
                        this.cancelEdit();
                        return true;
                    });
                }
            }
            this.adaptSpecialField();
            this.$nextTick(() => {
                resolve();
            });
            this.onDestroy(() => {
                resolve();
            });
            // console.timeEnd(label);
        });
    }

    renderedCallback() {
        super.renderedCallback();

    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.hasCellInit = false;
        this.sendParents('destroy');
    }

    connectedCallback() {
        super.connectedCallback();
        // this.checkRenderTime();
    }

    async initByCell() {
        const { cell } = this;
        const { hide, tableIdentity } = cell;
        this.deployContainer = LocalCacheService.getDeployContainer(tableIdentity);
        this.deployContainer.delaySize = 100;
        if (hide) {
            return;
        }
        // console.log(this.infectedByRows);
        // console.log(this.cellHashcode === cell.rowsHashcode);
        if (this.cellHashcode !== cell.cellHashcode || (this.infectedByRows ? this.rowsHashcode === cell.rowsHashcode : false)) {
            this.cellHashcode = cell.cellHashcode;
            // this.row = cell.getThisRow(cell.rowIdentity);
            if (cell.renderedImmediately) {
                this.applyChanges();
                return;
            }
            await this.deployContainer.waitDelay(
                () => {
                    return this.applyChanges();
                }
            );
        }
    }

    cellConfigs = {};

    parseCellConfigs() {
        const cell = this.cell;
        this.cellConfigs = cell.getCellConfigs();

        // const params = parseFuncParams({
        //     row: this.getThisRow() || {}, index: this.index, rows: this.getKeyRows.bind(this),
        //     field: this.field
        // }, this.reactiveValueFields);

        const proxy = Utils.getReferenceProxy({
            ...this.cellConfigs,
            value: () => this.fieldValue,
            displayValue: () => this.displayValue
        });

        Helper.generateComputedValue.bind(this)(proxy);
        Helper.generateUrlInfo.bind(this)(proxy);
        Helper.generateTipInfo.bind(this)(proxy);
        Helper.generateTypeInfo.bind(this)(proxy);
        Helper.generateEditorInfo.bind(this)(proxy);
        Helper.generateTreeInfo.bind(this)(proxy);
        Helper.generateActionInfo.bind(this)(proxy);
        Helper.generateClassStyle.bind(this)(proxy);
        Helper.onCellRenderedEnd.bind(this)(proxy);
    }

    refreshEditorInfo() {
        const cell = this.cell;
        this.cellConfigs = cell.getCellConfigs();
        const params = parseFuncParams({
            row: this.getThisRow(), index: this.index, rows: this.getKeyRows.bind(this),
            field: this.field
        }, this.reactiveValueFields);
        Helper.generateEditorInfo.bind(this)(params);
    }


    get rootClass() {
        return Utils.generateClassName(
            this.hoverClass,
            {
                'waiting-background': this.extra.hasWaitingBackground && !this.alwaysEditing
            }
        );
    }

    get rootStyle() {
        return [
            this.hoverStyle
        ].join(';');
    }

    get rowIdentityValue() {
        return this.cell[this.keyField];
    }

    adaptSpecialField() {
        this.editor.picklistOptions = [...this.editor.picklistOptions];
        this.popover.bodyLines = [...this.popover.bodyLines];
        this.actions = [...this.actions];
    }

    beforeEdit(event = {}) {
        const cell = this.cell;
        const typeMapper = CellAdapter.TYPE_MAPPER;
        let onEdit = cell.getCallback('onEdit');
        let formatInfo = {};
        if (this.dataType.toLowerCase() === 'percent') {
            formatInfo.formatter = this.percentFixed ? 'percent-fixed' : 'percent';
        }
        const thisRow = cell.getThisRow(this.rowIdentityValue);
        // this.refreshEditorInfo();
        // console.log(this.field, thisRow.Username, this.realValue);
        let editResultInfo = onEdit({
            cell: this, standard: {
                editorValue: this.realValue,
                editorHistory: [],
                editorType: this.type,
                editorOption: {
                    referenceAPI: this.editor.referenceAPI,
                    options: this.editor.picklistOptions,
                    ...formatInfo
                },
                isEdit: true,
                backgroundDisappearTime: 500
            }, row: thisRow
        });
        if (editResultInfo) {
            if (this.autoSave) {
                this.registerAllEditorEvent();
                if (event.stopPropagation) {
                    event.cancelBubble = true;
                    event.stopPropagation();
                }
            }
            // map the input type
            editResultInfo.editorType = editResultInfo.editorType.toLowerCase();
            const typeMapped = typeMapper[editResultInfo.editorType] || { option: {} };
            editResultInfo.editorType = typeMapped.type || 'text';
            editResultInfo.typeFlag = Utils.fromEntries(
                Object.entries(typeMapper).map(
                    ([, value]) => ['is_' + value.type, editResultInfo.editorType === value.type])
            );
            editResultInfo.typeFlag['is_input'] = !(
                editResultInfo.typeFlag['is_reference'] ||
                editResultInfo.typeFlag['is_multipicklist'] ||
                editResultInfo.typeFlag['is_picklist'] ||
                editResultInfo.typeFlag['is_reference'] ||
                editResultInfo.typeFlag['is_textarea']
            );
            editResultInfo.editedValue = editResultInfo.editorValue;
            editResultInfo.editorOption = { ...typeMapped.option, ...editResultInfo.editorOption };
            // config editor info
            let editorId = '_' + Utils.genID(4) + '_editor';
            const baseCellInfo = {
                editorId, field: this.field, index: this.index,
                className: [
                    editorId, editResultInfo.typeFlag['is_textarea'] ? 'textarea-item' : '',
                    editResultInfo.typeFlag['is_textarea'] && this.editor.textareaExpand ? 'expand' : ''
                ].join(' ')
            };
            this.isEdit = editResultInfo.isEdit;
            Object.assign(this.extra, {
                ...baseCellInfo, ...editResultInfo
            });
            Object.assign(this.extra, {
                ...baseCellInfo, ...editResultInfo,
                isWaiting: false, hasError: false, errorMessage: '', hasWaitingBackground: true
            });
            // console.log(JSON.stringify(this.extra.editorOption));
        }
        this.sendParents('doEditing');
        if (!event.preventFocus) {
            this.$nextTick(() => {
                const { editorId = '' } = this.extra;
                if (editorId) {
                    const ele = this.template.querySelector('.' + editorId);
                    if (ele) {
                        ele.focus();
                    }
                }
            });
        }
    }

    assignValue(changeEvent) {
        const { cell } = this;
        const eventInfo = changeEvent.target || changeEvent.detail;
        let extra = this.extra;
        const thisRow = cell.getThisRow(this.rowIdentityValue);
        extra.editedValue = eventInfo.value || eventInfo.checked;
        extra.isNotChanged = extra.editedValue === extra.editorValue;
        extra.editorHistory.unshift(extra.editedValue);
        extra.editorHistory = [...extra.editorHistory].slice(0, 2);
        let onValueChanged = cell.getCallback('onValueChanged');
        onValueChanged({
            cell: this, row: thisRow, extra: { ...extra }, action: {
                preventChange: () => {
                    // console.log([...extra.editorHistory]);
                    let lastValue = extra.editorHistory[1];
                    lastValue == null && (lastValue = extra.editorValue);
                    extra.editorHistory.unshift(lastValue);
                    extra.editorHistory = [...extra.editorHistory].slice(0, 2);
                    eventInfo.value = lastValue;
                    eventInfo.checked = lastValue;
                }
            }
        });
    }

    sendParents(api, params = {}) {
        const { cell = {} } = this;
        if (typeof cell.sendParents === 'function') {
            cell.sendParents(api, { ...cell, ...params });
        }
    }

    cancelEdit() {
        this.removeAllEditorListener();
        this.isEdit = false;
        // console.log('cancel editor');
        this.extra.hasWaitingBackground = false;
        this.sendParents('cancelEditing');
    }

    onEditSubmit() {
        const cell = this.cell;
        const extra = this.extra;
        const editorId = extra.editorId;
        const { backgroundDisappearTime, hasWaitingBackground } = this.extra;
        this.removeAllEditorListener();
        let input = this.template.querySelector(`.${editorId}`);
        const onEditSubmit = cell.getCallback('onEditSubmit');
        if (hasWaitingBackground) {
            this.isEdit = false;
        }
        Promise.resolve(
            onEditSubmit(parseFuncParams({
                value: extra.editorType === 'checkbox' ? input.checked : input.value, cell,
                row: cell.getThisRow(this.rowIdentityValue),
                displayValue: input.displayVal, rows: this.getKeyRows.bind(this)
            }, this.reactiveValueFields))
        ).then(is => {
            this.isEdit = !is;
            return Utils.waitTodo(this.extra.backgroundDisappearTime);
        }).then(() => {
            this.extra.hasWaitingBackground = false;
        }).catch(e => {
            this.isEdit = true;
            this.extra.isWaiting = false;
            this.extra.hasError = true;
            this.extra.errorMessage = Utils.getMessage(e, 10);
            this.registerAllEditorEvent();
        });
    }

    onBlur() {
        const extra = this.extra;
        const isTextarea = extra.typeFlag['is_textarea'];
        if (isTextarea && this.editor.textareaExpand) {
            const editorId = extra.editorId;
            if (editorId) {
                extra.className = [
                    editorId, 'textarea-item', 'expand'
                ].join(' ');
                extra.isFocus = false;
            }
        }
    }

    onFocus() {
        const extra = this.extra;
        const isTextarea = extra.typeFlag['is_textarea'];
        if (isTextarea && this.editor.textareaExpand) {
            const editorId = extra.editorId;
            if (editorId) {
                extra.className = [
                    editorId, 'textarea-item', 'expand', 'is-focus'
                ].join(' ');
                extra.isFocus = true;
            }
        }
    }

    onActionClick(e) {
        const cell = this.cell;
        const target = e.currentTarget;
        let identity;
        if (target.name && target.name.identity) {
            identity = target.name.identity;
        } else {
            target.getAttribute('data-action-identity');
        }
        const { rowIdentity, field, index } = this;
        const onActionClick = cell.getCallback('onActionClick');
        onActionClick(parseFuncParams({
            field, identity, row: cell.getThisRow(rowIdentity),
            rows: this.getKeyRows.bind(this), index
        }, this.reactiveValueFields));
    }

    onButtonClick() {
        const cell = this.cell;
        let onClick = cell.getCallback('onButtonClick');
        const thisRow = this.getThisRow();
        const mode = {};
        onClick({ cell, row: thisRow, mode });
        if (mode.isEdit) {
            this.beforeEdit();
        }
    }

    onUrlClick(event) {
        const cell = this.cell;
        let onUrlClick = cell.getCallback('onUrlClick');
        onUrlClick({ event, row: this.getThisRow() });
    }

    onToggleExpand() {
        const cell = this.cell;
        const onExpandChanged = cell.getCallback('onExpandChanged');
        onExpandChanged(parseFuncParams({
            row: this.getThisRow(),
            cell, isExpand: this.tree.isExpand
        }, this.reactiveValueFields));
    }

    handleAutoSubmit = () => {
        if (this.isEdit) {
            console.log('Auto save');
            this.onEditSubmit();
            this.removeAllEditorListener();
        }
    };

    handleEnterToSave = (e) => {
        if (e.keyCode === 27) {
            if (this.isEdit) {
                console.log('ESC to exist');
                this.cancelEdit();
                this.removeAllEditorListener();
            }
        }
    };

    handleEscToExit = (e) => {
        if (e.keyCode === 13) {
            if (this.isEdit && !this.extra.typeFlag.is_textarea) {
                console.log('Enter to save');
                this.onEditSubmit();
                this.removeAllEditorListener();
            }
        }
    };

    registerAllEditorEvent() {
        this.autoSaveEventId = Utils.registerDOMEvent(window, 'click', this.handleAutoSubmit);
        this.enterToSaveEventId = Utils.registerDOMEvent(window, 'keyup', this.handleEnterToSave);
        this.escToExitEventId = Utils.registerDOMEvent(window, 'keyup', this.handleEscToExit);

    }

    removeAllEditorListener() {
        const { autoSaveEventId, enterToSaveEventId, escToExitEventId } = this;
        Utils.removeDOMEvent(autoSaveEventId);
        Utils.removeDOMEvent(enterToSaveEventId);
        Utils.removeDOMEvent(escToExitEventId);
    }

    preventEvent(e) {
        e.cancelBubble = true;
        e.stopPropagation();
    }


    handleDblclick() {
        if (this.editable && !this.isEdit) {
            this.beforeEdit();
        }
    }
}