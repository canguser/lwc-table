import { parsePosition } from './utils';
import Utils from 'c/utils';

export default class Helper {

    static generateComputedValue(proxy) {
        const { fieldValue, displayValue, displayField } = this;
        const computedInfo = {
            isComputed: proxy.doCompute,
            hasTitle: proxy.hasTitle,
            title: proxy.title,
            value: displayField ? displayValue : fieldValue
        };
        if (computedInfo.isComputed) {
            computedInfo.value = proxy.computedValue;
        }
        if (computedInfo.hasTitle && computedInfo.title === '') {
            computedInfo.title = computedInfo.value;
        }
        Object.assign(this, computedInfo);
    }

    static generateUrlInfo(proxy) {
        const urlInfo = {
            url: proxy.url,
            usingUrl: proxy.usingUrl,
            urlValue: proxy.urlValue
        };
        const urlValue = (urlInfo.urlValue || '') + '';
        const value = (this.value || '') + '';
        if (urlInfo.usingUrl && urlInfo.urlValue) {
            const indexOf = value.indexOf(urlValue);
            if (indexOf === 0 || indexOf + urlValue.length >= value.length) {
                this.value = value.slice(indexOf, indexOf + urlValue.length);
                this.noneUrlValue = value.slice(indexOf + urlValue.length);
            }
        }
        Object.assign(this, urlInfo);
    }

    static generateTipInfo(proxy) {
        const hasCellTip = proxy.hasCellTip;
        const cellTipInfo = {
            tip: {
                content: proxy.cellTip,
                variant: proxy.cellTipVariant,
                icon: proxy.cellTipIcon,
                isCustom: proxy.isCustomCellTip,
                position: parsePosition(proxy.cellTipPosition, hasCellTip)
            },
            hasCellTip
        };
        Object.assign(this, cellTipInfo);
    }

    static generateTypeInfo(proxy) {
        const { fieldValue } = this;

        const typeInfo = {
            dataType: proxy.type.toLowerCase(),
            percentFixed: proxy.percentFixed,
            percentUnit: proxy.percentUnit,
            percentDecimal: proxy.percentDecimal,
            cellType: proxy.cellType.toLowerCase(),
            button: {}
        };

        const strategyMap = {
            'reference': () => {
                if (!this.usingUrl) {
                    typeInfo.usingUrl = true;
                    typeInfo.url = '/' + fieldValue;
                }
            },
            'boolean': () => {
                typeInfo.isBoolean = true;
                typeInfo.usingUrl = false;
            },
            'percent': () => {
                const { value } = this;
                if (value !== '') {
                    const preValue = parseFloat(value);
                    if (Number.isNaN(preValue) || preValue === Infinity) {
                        typeInfo.value = '';
                    } else {
                        typeInfo.value = parseFloat((typeInfo.percentFixed ? (value / 100) : value) * 100).toFixed(typeInfo.percentDecimal) + typeInfo.percentUnit;
                    }
                }
                typeInfo.isStandard = true;
            },
            '_default': () => {
                typeInfo.isStandard = true;
                typeInfo.isBoolean = false;
            }
        };

        const cellTypeMap = {
            'button': () => {
                typeInfo.button.is = true;
                typeInfo.button.variant = proxy.buttonVariant;
                typeInfo.button.disabled = proxy.disabled;
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

        Object.assign(this, typeInfo);
    }

    static generateEditorInfo(proxy) {
        const { fieldValue, cIndex, value, dataType, cell } = this;
        const cellIsOuterEditor = proxy.isOuterEditor;
        const isOuterEditor = (cell.getContextProperty('isOuterEditor') && cellIsOuterEditor == null) || cellIsOuterEditor === true;
        const editorClass = [
            'editor-input',
            'slds-p-around--x-small',
            'slds-is-relative',
            isOuterEditor ? 'outer-editor' : '',
            isOuterEditor && cIndex > cell.getContextProperty('columns').length / 2 ? 'outer-editor-right' : ''
        ].join(' ').trim();
        const picklistOptions = proxy.picklistOptions || [];
        const selectedValues = (typeof fieldValue === 'string' && fieldValue.split(';').map(v => v.trim())) || [];
        const picklistSelectedOptions = picklistOptions.filter(option => selectedValues.includes(option.value));
        const avatarUrl = proxy.avatarUrl;
        const helperText = proxy.editorHelperText;
        const editInfo = {
            editor: {
                className: editorClass, isOuter: isOuterEditor,
                textareaExpand: proxy.textareaExpand,
                referenceAPI: proxy.referenceAPI,
                picklistOptions, helperText,
                hasHelperText: !!helperText
            },
            type: dataType, avatarUrl,
            hasCellInit: false,
            hasAvatar: proxy.hasAvatar && avatarUrl,
            editable: proxy.editable,
            alwaysEditing: proxy.isEditing,
            autoSave: proxy.autoSave,
            value: picklistSelectedOptions.length > 1 ? picklistSelectedOptions.map(opt => opt.label).join(';') : value
        };
        editInfo.editIconPosition = parsePosition(proxy.editIconPosition, editInfo.editable);
        editInfo.hasSaveButton = !cell.getContextProperty('usingSaveAll') && !editInfo.autoSave;
        this.isAlwaysEditingChanged = editInfo.alwaysEditing !== this.alwaysEditing;
        Object.assign(this, editInfo);
    }

    static generateTreeInfo(proxy) {
        const { cIndex, cell } = this;
        let tInfo = {};
        if (cIndex === cell.getContextProperty('treeIndex') && cell.getContextProperty('usingTree')) {
            tInfo = {
                tree: {
                    ...this.tree,
                    isTreeHeader: cIndex === cell.getContextProperty('treeIndex') && cell.getContextProperty('usingTree')
                }
            };
            tInfo.tree.treeIcon = tInfo.tree.isExpand ? 'utility:chevrondown' : 'utility:chevronright';
            tInfo.paddingLeft = 'padding-left: ' + ((tInfo.tree.indent || 0) + (tInfo.tree.showExpand ? 0 : 1)) + 'rem';
        }
        Object.assign(this, tInfo);
    }

    static generateActionInfo(proxy) {
        const { rowIdentity, field, index, cell } = this;
        const actionInfo = {
            actions: proxy.actions
                .map((action, i) => ({
                    ...cell.basicActionConfig,
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
                        'slds-button', 'icon-adapt'
                    ].join(' ').trim(),
                    isDisabled: action.disabled,
                    disabled: action.disabled ? 'disabled' : '',
                    isIconType: action.type === 'icon',
                    isButtonIconType: action.type === 'button-icon',
                    isDynamicIconType: action.type === 'dynamic-icon',
                    isButtonType: action.type === 'button',
                    tempData: { identity: action.identity, rowIdentity, field, index }
                }))
        };
        Object.assign(actionInfo, {
            actionHasStart: !!actionInfo.actions.find(action => action.position.isStart),
            actionHasInsertBefore: !!actionInfo.actions.find(action => action.position.isInsertBefore),
            actionHasAppend: !!actionInfo.actions.find(action => action.position.isAppend),
            actionHasEnd: !!actionInfo.actions.find(action => action.position.isEnd)
        });
        Object.assign(this, actionInfo);
    }

    static generateClassStyle(proxy) {
        const { cIndex, cell } = this;
        const align = proxy.align;
        const hoverVerticalHighlight = proxy.hoverVerticalHighlight;
        const cellClass = [proxy.cellClass, 'slds-text-align--' + align].join(' ');
        const isWrap = proxy.isWrap;
        const padding = proxy.padding;
        const lineHeight = proxy.lineHeight;
        const height = proxy.height;
        const tdClassArr = [
            'slds-is-relative',
            '_align-' + align,
            cell.getContextProperty('showColumnHighlight') && hoverVerticalHighlight ? 'column-highlight' : ''
        ];
        const tdStyles = [
            padding.top ? 'padding-top: ' + padding.top + 'rem' : '',
            padding.right ? 'padding-right: ' + padding.right + 'rem' : '',
            padding.bottom ? 'padding-bottom: ' + padding.bottom + 'rem' : '',
            padding.left ? 'padding-left: ' + padding.left + 'rem' : '',
            'line-height: ' + lineHeight,
            'height: ' + height
        ];
        const textStyle = [];
        const background = proxy.background;
        const textColor = proxy.textColor;
        const textStyleStr = proxy.textStyle;
        if (background) {
            tdStyles.push(`background: ${background}`);
        }
        if (textColor) {
            tdStyles.push(`color: ${textColor}`);
            textStyle.push(`color: ${textColor}`);
        }
        if (textStyleStr) {
            textStyle.push(textStyleStr);
        }
        const spanStyle = [this.paddingLeft || ''].join('; ').trim();
        const tdClass = tdClassArr.join(' ').trim();
        const cellPopoverTitle = proxy.cellPopoverTitle,
            cellPopoverBody = proxy.cellPopoverBody,
            cellPopoverPosition = proxy.cellPopoverPosition,
            showCellPopover = proxy.showCellPopover;
        const autoPosition = cell.getContextProperty('columns').length > cIndex * 2 ? 'left-top' : 'right-top';

        const cellPopoverPositionMapper = Utils.generateStrategyMapper(
            {
                'auto': autoPosition,
                'left': 'left-top',
                'right': 'right-top'
            }, autoPosition, true
        );

        const isCustomized = !!proxy.customizeType;
        const customizedInfo = {
            isAvatarDesc: ['avatar-desc'].includes(proxy.customizeType),
            describe: proxy.describe,
            isProgressBar: ['process-bar'].includes(proxy.customizeType),
            progressPercent: Utils.realNumber(proxy.progressPercent),
            progressTitle: proxy.progressTitle
        };

        if (customizedInfo.isProgressBar) {
            customizedInfo.progressBarClass = 'slds-progress-bar slds-progress-bar_circular' + (customizedInfo.progressPercent > 1 && customizedInfo.progressPercent !== Infinity ? ' bar-overflow' : '');
            customizedInfo.progressStyle = [
                'width: ' + (customizedInfo.progressPercent <= 1 ? (customizedInfo.progressPercent * 100).toFixed() : (1 / customizedInfo.progressPercent * 100).toFixed()) + '%'
            ].join(';');
            customizedInfo.progressPercentFormatter = Utils.convertPercent(customizedInfo.progressPercent);
        }

        if (customizedInfo.isAvatarDesc) {
            customizedInfo.hasAvatarDesc = customizedInfo.isAvatarDesc && !!customizedInfo.describe;
        }

        const textWrap = [
            'slds-show_inline-block slds-truncate',
            customizedInfo.isAvatarDesc ? 'avatar-desc' : '',
            customizedInfo.isProgressBar ? 'slds-size_1-of-1 no-truncate' : ''
        ].join(' ');
        const textInnerWrap = [
            'slds-truncate',
            customizedInfo.isProgressBar ? 'progress-main-text' : ''
        ].join(' ');

        const classStyleInfo = {
            popover: {
                title: cellPopoverTitle,
                bodyLines: (cellPopoverBody instanceof Array ? cellPopoverBody : [cellPopoverBody]).map((line, i) => ({
                    key: i, line
                })),
                className: ['cell-popover', 'slds-popover', 'slds-nubbin_' + cellPopoverPositionMapper[cellPopoverPosition]].join(' ')
            },
            hasPopover: showCellPopover, textWrap, textInnerWrap,
            align, cellClass, spanStyle, tdClass, isCustomized, customizedInfo
        };
        const shownOnHover = proxy.shownOnHover;
        const shownOnHoverAlign = proxy.shownOnHoverAlign;
        const shownOnHoverMaxWidth = proxy.shownOnHoverMaxWidth;
        const shownOnHoverMinWidth = proxy.shownOnHoverMinWidth;
        const shownOnHoverNowrap = proxy.shownOnHoverNowrap;
        const alignStrategy = {
            left: '',
            auto: cIndex > cell.getContextProperty('columns').length / 2 ? 'shown-on-hover-right' : '',
            right: 'shown-on-hover-right'
        };

        const hoverStyles = [];

        if (shownOnHoverMaxWidth) {
            hoverStyles.push(`max-width: ${shownOnHoverMaxWidth}`);
            hoverStyles.push(`min-width: ${shownOnHoverMinWidth}`);
        }

        classStyleInfo.hoverClass = [
            'table-cell',
            customizedInfo.isProgressBar ? 'progress-bar-box' : '',
            isWrap ? 'wrapped-cell' : '',
            this.tip.position.isEnd || this.tip.position.isEnd || this.actionHasEnd || this.editIconPosition.isEnd ? 'has-cell-end' : '',
            this.tip.position.isStart || this.tip.position.isStart || this.actionHasStart || this.editIconPosition.isStart ? 'has-cell-start' : '',
            this.editIconPosition.isStart ? 'hover-edit has-cell-edit-start' : '',
            this.editIconPosition.isEnd ? 'hover-edit has-cell-edit-end' : '',
            'cell-shown-on',
            shownOnHover ? 'shown-on-hover' : '',
            shownOnHover && shownOnHoverNowrap ? 'shown-on-nowrap' : '',
            alignStrategy[shownOnHoverAlign]
        ].join(' ');
        classStyleInfo.style = tdStyles.join('; ');
        classStyleInfo.textStyle = textStyle.join('; ');
        classStyleInfo.hoverStyle = hoverStyles.join('; ');
        Object.assign(this, classStyleInfo);
    }

    static onCellRenderedEnd(proxy) {
        const { fieldValue } = this;
        Object.assign(this, {
            realValue: fieldValue
        });
    }
}