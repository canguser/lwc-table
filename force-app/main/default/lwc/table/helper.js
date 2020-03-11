import { genID, parsePosition } from './utils';
import Utils from 'c/utils';

export default class Helper {

    static generateComputedValue(info, params, config) {
        const { fieldValue, displayValue, displayField } = info;
        const computedInfo = {
            isComputed: config.doCompute(params),
            hasTitle: config.hasTitle(params),
            title: config.title(params),
            value: displayField ? displayValue : fieldValue
        };
        if (computedInfo.isComputed) {
            Object.assign(params, { value: fieldValue, displayValue });
            computedInfo.value = config.computedValue(params);
        }
        if (computedInfo.hasTitle && computedInfo.title === '') {
            computedInfo.title = computedInfo.value;
        }
        Object.assign(info, computedInfo);
    }

    static generateUrlInfo(info, params, config, { getCallback, context }) {
        const urlInfo = {
            url: config.url(params),
            usingUrl: config.usingUrl(params),
            onUrlClick: (event) => {
                let identity = event.target.getAttribute('data-row-identity');
                let onUrlClick = getCallback('onUrlClick');
                onUrlClick({ event, row: context.keyRows.find(row => row._identity === identity) });
            }
        };
        Object.assign(info, urlInfo);
    }

    static generateTipInfo(info, params, config) {
        const hasCellTip = config.hasCellTip(params);
        const cellTipInfo = {
            cellTip: config.cellTip(params),
            hasCellTip,
            cellTipVariant: config.cellTipVariant(params),
            cellTipIcon: config.cellTipIcon(params),
            isCustomCellTip: config.isCustomCellTip(params),
            cellTipPosition: parsePosition(config.cellTipPosition(params), hasCellTip)
        };
        Object.assign(info, cellTipInfo);
    }

    static generateTypeInfo(info, params, config, { getCallback, context }) {
        const { fieldValue } = info;

        const typeInfo = {
            dataType: config.type(params).toLowerCase(),
            percentFixed: config.percentFixed(params),
            cellType: config.cellType(params).toLowerCase()
        };

        const strategyMap = {
            'reference': () => {
                if (!info.usingUrl) {
                    typeInfo.usingUrl = true;
                    typeInfo.url = '/' + fieldValue;
                }
            },
            'boolean': () => {
                typeInfo.isBoolean = true;
                typeInfo.usingUrl = false;
            },
            'percent': () => {
                const { value } = info;
                if (value !== '') {
                    const preValue = parseFloat(value);
                    if (Number.isNaN(preValue) || preValue === Infinity) {
                        typeInfo.value = '';
                    } else {
                        typeInfo.value = parseFloat((typeInfo.percentFixed ? (value / 100) : value) * 100).toFixed(0) + '%';
                    }
                }
                typeInfo.isStandard = true;
            },
            '_default': () => {
                typeInfo.isStandard = true;
            }
        };

        const cellTypeMap = {
            'button': () => {
                typeInfo.isButton = true;
                typeInfo.buttonVariant = config.buttonVariant(params);
                typeInfo.buttonDisabled = config.disabled(params);
                typeInfo.onButtonClick = (e) => {
                    const cell = e.currentTarget.name;
                    let onClick = getCallback('onButtonClick');
                    const thisRow = context.keyRows.find(row => row._identity === cell.rowIdentity);
                    const mode = {};
                    onClick({ cell, row: thisRow, mode });
                    if (mode.isEdit) {
                        cell.onEdit(e);
                    }
                };
                typeInfo.usingUrl = false;
                typeInfo.isStandard = false;
            },
            '_default': () => undefined
        };
        let strategyMethod = strategyMap[typeInfo.dataType];
        if (typeof strategyMethod !== 'function') {
            strategyMethod = strategyMap['_default'];
        }

        let cellTypeMethod = cellTypeMap[typeInfo.cellType];
        if (typeof cellTypeMethod !== 'function') {
            cellTypeMethod = cellTypeMap['_default'];
        }
        // execute the strategy.
        strategyMethod();
        cellTypeMethod();

        Object.assign(info, typeInfo);
    }

    static generateEditorInfo(info, params, config, { getCallback, context, typeMapper }) {
        const { fieldValue, percentFixed, cIndex, value, dataType, keyField, extra } = info;
        const editorClass = [
            'editor-input',
            'slds-p-around--x-small',
            'slds-is-relative',
            extra.hasError ? 'error' : '',
            context.isOuterEditor ? 'outer-editor' : '',
            context.isOuterEditor && cIndex > context.columns.length / 2 ? 'outer-editor-right' : ''
        ].join(' ').trim();
        const picklistOptions = config.picklistOptions(params) || [];
        const selectedValues = (typeof fieldValue === 'string' && fieldValue.split(';').map(v => v.trim())) || [];
        const picklistSelectedOptions = picklistOptions.filter(option => selectedValues.includes(option.value));
        const avatarUrl = config.avatarUrl(params);
        const editInfo = {
            type: dataType, editorClass, avatarUrl,
            hasAvatar: config.hasAvatar(params) && avatarUrl,
            editable: config.editable(params),
            referenceAPI: config.referenceAPI(params),
            alwaysEditing: config.isEditing(params),
            autoSave: config.autoSave(params),
            value: picklistSelectedOptions.length > 1 ? picklistSelectedOptions.map(opt => opt.label).join(';') : value,
            onEdit: (event) => {
                let cell = event.currentTarget.name;
                let onEdit = getCallback('onEdit');
                let formatInfo = {};
                if (dataType.toLowerCase() === 'percent') {
                    formatInfo.formatter = percentFixed ? 'percent-fixed' : 'percent';
                }
                const thisRow = context.keyRows.find(row => row._identity === cell.rowIdentity);
                let editResultInfo = onEdit({
                    cell, standard: {
                        editorValue: cell.realValue,
                        editorHistory: [],
                        editorType: cell.type,
                        editorOption: {
                            referenceAPI: cell.referenceAPI,
                            options: picklistOptions,
                            ...formatInfo
                        },
                        isEdit: true,
                        backgroundDisappearTime: 500
                    }, row: thisRow
                });
                if (editResultInfo) {
                    if (editInfo.autoSave) {
                        const extraNotTracked = context.cellInMatrixNotTracked[cell[keyField]][cell.cIndex];
                        this.registerAllEditorEvent(editInfo, extraNotTracked);
                        if (event.stopPropagation) {
                            context.preventEvent(event);
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
                    let editorId = '_' + genID(4) + '_editor';
                    const baseCellInfo = {
                        editorId, field: cell.field, index: cell.index
                    };
                    Object.assign(context.cellInMatrixNotTracked[cell[keyField]][cell.cIndex], {
                        ...baseCellInfo, ...editResultInfo
                    });
                    Object.assign(context.cellInMatrix[cell[keyField]][cell.cIndex], {
                        ...baseCellInfo, ...editResultInfo,
                        isWaiting: false, hasError: false, errorMessage: '', hasWaitingBackground: true,
                        assignValue: (changeEvent) => {
                            // try {
                            const eventInfo = changeEvent.target || changeEvent.detail;
                            let cell = eventInfo.name;
                            let extra = context.cellInMatrixNotTracked[cell[keyField]][cell.cIndex];
                            extra.editedValue = eventInfo.value || eventInfo.checked;
                            extra.isNotChanged = extra.editedValue === extra.editorValue;
                            extra.editorHistory.unshift(extra.editedValue);
                            extra.editorHistory = [...extra.editorHistory].slice(0, 2);
                            let onValueChanged = getCallback('onValueChanged');
                            onValueChanged({
                                cell, row: thisRow, extra: { ...extra }, action: {
                                    preventChange: () => {
                                        // console.log([...extra.editorHistory]);
                                        let lastValue = extra.editorHistory['$1'];
                                        lastValue == null && (lastValue = extra.editorValue);
                                        extra.editorHistory.unshift(lastValue);
                                        extra.editorHistory = [...extra.editorHistory].slice(0, 2);
                                        eventInfo.value = lastValue;
                                        eventInfo.checked = lastValue;
                                    }
                                }
                            });
                        }
                    });
                }
            },
            cancelEdit: (event) => {
                let cell = event.currentTarget.name;
                this.removeAllEditorListener(context.cellInMatrixNotTracked[cell[keyField]][cell.cIndex]);
                const cellInMatrix = context.cellInMatrix[cell[keyField]][cell.cIndex];
                cellInMatrix.isEdit = false;
                cellInMatrix.hasWaitingBackground = false;
            },
            onEditSubmit: (event) => {
                let cell = event.currentTarget.name;
                let onEditSubmit = getCallback('onEditSubmit');
                let editorId = context.cellInMatrix[cell[keyField]][cell.cIndex].editorId;
                this.removeAllEditorListener(context.cellInMatrixNotTracked[cell[keyField]][cell.cIndex]);
                let input = context.template.querySelector(`.${editorId}`);
                const cellInMatrix = context.cellInMatrix;
                cellInMatrix[cell[keyField]][cell.cIndex].isWaiting = true;
                Promise.resolve().then(() => {
                    let row = context.keyRows.find(row => cell[keyField] === row[keyField]);
                    // console.log(row);
                    context.cellInMatrix[cell[keyField]][cell.cIndex].editRow = row;
                    return onEditSubmit({
                        value: input.value == null ? input.checked : input.value, cell, row,
                        displayValue: input.displayVal, rows: context.keyRows
                    });
                }).then(isClosed => {
                    cellInMatrix[cell[keyField]][cell.cIndex].isWaiting = false;
                    cellInMatrix[cell[keyField]][cell.cIndex].isEdit = !isClosed;
                    // Why waiting? show user the process that background is changing to yellow.
                    return Utils.waitTodo(cellInMatrix[cell[keyField]][cell.cIndex].$backgroundDisappearTime || 0);
                }).then(() => {
                    cellInMatrix[cell[keyField]][cell.cIndex].hasWaitingBackground = false;
                }).catch(e => {
                    cellInMatrix[cell[keyField]][cell.cIndex].isWaiting = false;
                    cellInMatrix[cell[keyField]][cell.cIndex].hasError = true;
                    cellInMatrix[cell[keyField]][cell.cIndex].errorMessage = Utils.getMessage(e, 10);
                    this.registerAllEditorEvent(editInfo, context.cellInMatrixNotTracked[cell[keyField]][cell.cIndex]);
                    console.log(e);
                });
            },
            dblclick: () => {
                const extra = context.cellInMatrix[info[keyField]][info.cIndex];
                if (editInfo.editable && !extra.$isEdit) {
                    editInfo.onEdit({ currentTarget: { name: info } });
                }
            },
            handleAutoSubmit: (e) => {
                console.log('Auto save');
                const extra = context.cellInMatrix[info[keyField]][info.cIndex];
                if (extra.$isEdit) {
                    editInfo.onEditSubmit({ currentTarget: { name: info } });
                    this.removeAllEditorListener(context.cellInMatrixNotTracked[info[keyField]][info.cIndex]);
                }
            },
            handleEscToExit: (e) => {
                if (e.keyCode === 27) {
                    console.log('ESC to exist');
                    const extra = context.cellInMatrix[info[keyField]][info.cIndex];
                    if (extra.$isEdit) {
                        editInfo.cancelEdit({ currentTarget: { name: info } });
                        this.removeAllEditorListener(context.cellInMatrixNotTracked[info[keyField]][info.cIndex]);
                    }
                }
            },
            handleEnterToSave: (e) => {
                if (e.keyCode === 13) {
                    console.log('Enter to save');
                    const extra = context.cellInMatrix[info[keyField]][info.cIndex];
                    if (extra.$isEdit) {
                        editInfo.onEditSubmit({ currentTarget: { name: info } });
                        this.removeAllEditorListener(context.cellInMatrixNotTracked[info[keyField]][info.cIndex]);
                    }
                }
            }
        };
        editInfo.editIconPosition = parsePosition(config.editIconPosition(params), editInfo.editable);
        editInfo.hasSaveButton = !context.usingSaveAll && !editInfo.autoSave;
        Object.assign(info, editInfo);
    }

    static generateTreeInfo(info, params, config, { getCallback, context, treeInfo }) {
        const { cIndex, keyField } = info;
        let tInfo = {};
        if (cIndex === context.treeIndex && context.usingTree) {
            tInfo = {
                ...treeInfo, ...{
                    onToggleExpand: (event) => {
                        const cell = event.target.name;
                        const onExpandChanged = getCallback('onExpandChanged');
                        onExpandChanged({
                            row: context.keyRows.find(row => row[keyField] === cell[keyField]),
                            cell, isExpand: cell.isExpand
                        });
                    }
                },
                isTreeHeader: cIndex === context.treeIndex && context.usingTree
            };
            tInfo.treeIcon = tInfo.isExpand ? 'utility:chevrondown' : 'utility:chevronright';
            tInfo.paddingLeft = 'padding-left: ' + ((tInfo.indent || 0) + (tInfo.showExpand ? 0 : 1)) + 'rem';
        }
        Object.assign(info, tInfo);
    }

    static generateActionInfo(info, params, config, { context, getCallback, basicConfig }) {
        const { keyField, rowIdentity, field, index } = info;
        const actionInfo = {
            actions: config.actions(params)
                .map((action, i) => ({
                    ...basicConfig,
                    ...action,
                    identity: action.identity || i
                }))
                .map(action => ({
                    ...action,
                    position: parsePosition(action.position, action.status !== 'hidden'),
                    class: [
                        action.status === 'hover' ? 'action-hover' : '',
                        action.status === 'rowHover' ? 'action-row-hover' : '',
                        action.status === 'always' ? '' : 'hidden'
                    ].join(' ').trim(),
                    buttonClass: [
                        'slds-button'
                    ].join(' ').trim(),
                    isDisabled: action.disabled,
                    disabled: action.disabled ? 'disabled' : '',
                    isIconType: action.type === 'icon',
                    isButtonIconType: action.type === 'button-icon',
                    isDynamicIconType: action.type === 'dynamic-icon',
                    isButtonType: action.type === 'button',
                    tempData: { identity: action.identity, rowIdentity, field, index }
                })),
            onActionClick: e => {
                const currentTarget = e.currentTarget;
                const target = e.target || e.detail;
                if (target && target.name && target.name.identity) {
                    const { identity, rowIdentity, field, index } = target.name;
                    const onActionClick = getCallback('onActionClick');
                    onActionClick({
                        field, identity, row: context.keyRows.find(row => row[keyField] === rowIdentity),
                        rows: context.keyRows, index
                    });
                    return;
                }
                const identity = currentTarget.getAttribute('data-action-identity');
                const rowIdentity = currentTarget.getAttribute('data-row-identity');
                const field = currentTarget.getAttribute('data-row-field');
                const index = currentTarget.getAttribute('data-row-index');
                const onActionClick = getCallback('onActionClick');
                onActionClick({
                    field, identity, row: context.keyRows.find(row => row[keyField] === rowIdentity),
                    rows: context.keyRows, index
                });
            }
        };
        Object.assign(actionInfo, {
            actionHasStart: !!actionInfo.actions.find(action => action.position.isStart),
            actionHasInsertBefore: !!actionInfo.actions.find(action => action.position.isInsertBefore),
            actionHasAppend: !!actionInfo.actions.find(action => action.position.isAppend),
            actionHasEnd: !!actionInfo.actions.find(action => action.position.isEnd)
        });
        Object.assign(info, actionInfo);
    }

    static generateClassStyle(info, params, config, { context, getCallback }) {
        const { cIndex, keyField, extra } = info;
        const align = config.align(params);
        const hoverVerticalHighlight = config.hoverVerticalHighlight(params);
        const cellClass = [config.cellClass(params), 'slds-text-align--' + align].join(' ');
        const isWrap = config.isWrap(params);
        const padding = config.padding(params);
        const lineHeight = config.lineHeight(params);
        const tdClassArr = [
            'slds-is-relative',
            'table-cell',
            isWrap ? 'wrapped-cell' : '',
            info.cellTipPosition.isEnd || info.cellTipPosition.isEnd || info.actionHasEnd ? 'has-cell-end' : '',
            info.cellTipPosition.isStart || info.cellTipPosition.isStart || info.actionHasStart ? 'has-cell-start' : '',
            '_align-' + align,
            context.showColumnHighlight && hoverVerticalHighlight ? 'column-highlight' : '',
            extra.$hasWaitingBackground ? 'waiting-background' : ''
        ];
        const tdStyles = [
            padding.top ? 'padding-top: ' + padding.top + 'rem' : '',
            padding.right ? 'padding-right: ' + padding.right + 'rem' : '',
            padding.bottom ? 'padding-bottom: ' + padding.bottom + 'rem' : '',
            padding.left ? 'padding-left: ' + padding.left + 'rem' : '',
            'line-height: ' + lineHeight
        ];
        const background = config.background(params);
        const textColor = config.textColor(params);
        if (background) {
            tdStyles.push(`background: ${background}`);
        }
        if (textColor) {
            tdStyles.push(`color: ${textColor}`);
        }
        if (extra.$tdOverrideStyles && extra.$tdOverrideStyles.length > 0) {
            tdStyles.push(...extra.$tdOverrideStyles);
        }
        const spanStyle = [info.paddingLeft || ''].join('; ').trim();
        const tdClass = tdClassArr.join(' ').trim();
        const classStyleInfo = {
            align, cellClass, spanStyle, tdClass,
            onMouseIn(e) {
                let rIndex = e.target.getAttribute('data-cell-r-index');
                let cIndex = e.target.getAttribute('data-cell-c-index');
                const onMouseIn = getCallback('onMouseIn');
                const { rows } = params;
                const rKeyMap = Utils.fromEntries(
                    rows.map((row, i) => [i, row[keyField]])
                );
                const cKeyMap = Utils.fromEntries(
                    Array.apply(null, { length: context.columns.length }).map((empty, i) => [i, i])
                );
                const styleMap = new Map();
                onMouseIn.call(context, { styleMap, rKeyMap, cKeyMap, rIndex, cIndex, ...params });
                Array.from(styleMap.keys()).forEach(key => {
                    const [r, c] = key;
                    context.cellInMatrix[r][c].tdOverrideStyles = styleMap.get(key);
                });
            },
            onMouseOut(e) {
                let rIndex = e.target.getAttribute('data-cell-r-index');
                let cIndex = e.target.getAttribute('data-cell-c-index');
                const { rows } = params;
                const rKeyMap = Utils.fromEntries(
                    rows.map((row, i) => [i, row[keyField]])
                );
                const cKeyMap = Utils.fromEntries(
                    Array.apply(null, { length: context.columns.length }).map((empty, i) => [i, i])
                );
                const onMouseOut = getCallback('onMouseOut');
                const styleMap = new Map();
                onMouseOut.call(context, { styleMap, rKeyMap, cKeyMap, rIndex, cIndex, ...params });
                Array.from(styleMap.keys()).forEach(key => {
                    const [r, c] = key;
                    context.cellInMatrix[r][c].tdOverrideStyles = styleMap.get(key);
                });
            }
        };
        classStyleInfo.style = tdStyles.join('; ');
        const shownOnHover = config.shownOnHover(params);
        const shownOnHoverAlign = config.shownOnHoverAlign(params);
        const alignStrategy = {
            left: '',
            auto: cIndex > context.columns.length / 2 ? 'shown-on-hover-right' : '',
            right: 'shown-on-hover-right'
        };

        classStyleInfo.hoverClass = [
            shownOnHover ? 'shown-on-hover' : '',
            alignStrategy[shownOnHoverAlign]

        ].join(' ');
        Object.assign(info, classStyleInfo);
    }

    static onCellRenderedEnd(info, params, config, { context }) {
        const { alwaysEditing, extra, onEdit, cancelEdit, cIndex, keyField, fieldValue } = info;
        Object.assign(info, {
            symbol: `cells - [${info[keyField]},${cIndex}]`,
            realValue: fieldValue
        });
        if (alwaysEditing) {
            if (!extra.$hasInit) {
                context.queueTasks({
                    // initial action
                    action: () => {
                        // execute onEdit method.
                        extra.hasInit = true;
                        onEdit({ currentTarget: { name: info } });
                        return true;
                    }
                });
            }
        } else {
            if (extra.$hasInit) {
                context.queueTasks({
                    // initial action
                    action: () => {
                        // execute cancelEdit method.
                        extra.hasInit = false;
                        cancelEdit({ currentTarget: { name: info } });
                        return true;
                    }
                });
            }
        }
    }

    static removeAllEditorListener(extra = {}) {
        const { $autoSaveEventId, $enterToSaveEventId, $escToExitEventId } = extra;
        Utils.removeDOMEvent($autoSaveEventId);
        Utils.removeDOMEvent($enterToSaveEventId);
        Utils.removeDOMEvent($escToExitEventId);
    }

    static registerAllEditorEvent(editInfo, extra) {
        const autoSaveEventId = Utils.registerDOMEvent(window, 'click', editInfo.handleAutoSubmit);
        const enterToSaveEventId = Utils.registerDOMEvent(window, 'keyup', editInfo.handleEnterToSave);
        const escToExitEventId = Utils.registerDOMEvent(window, 'keyup', editInfo.handleEscToExit);
        Object.assign(extra, {
            autoSaveEventId, enterToSaveEventId, escToExitEventId
        });
    }
}