/**
 * Created by ryan on 2019-07-25.
 */

import { api, track } from 'lwc';
import LifecycleElement from 'c/lifecycleElement';
import { loadStyle } from 'lightning/platformResourceLoader';
import Resource from '@salesforce/resourceUrl/Resource';
import Utils from 'c/utils';
import {
    genID,
    parseFunctionFields,
    parseObject,
    parseObjectFields,
    parsePosition,
    preOrderTraversalTree
} from './utils';
import Helper from './helper';

export default class Table extends LifecycleElement {

    @api columns = [];
    @api rows = [];
    @api keyField = 'apiName';
    @api usingComputation = false;
    @api usingTree = false;
    @api treeIndex = 0;
    @api noRowBorder = false;
    @api noColumnBorder = false;
    @api usingSaveAll = false;
    @api autoWidth = false;
    @api isSortMulti = false;
    @api isOuterEditor = false;
    @api hideHeader = false;
    @api showColumnHighlight = false;
    @api scrollable = false;
    @api height = 400;
    @api minHeight = 0;
    @api infiniteLoading = false;
    // unreached.
    @api selectable = false;
    @api isMultipleSelected = false;
    @api className = '';

    @api
    set sortBy(sortBy) {
        if (this.isSortMulti) {
            this.sortInfo = sortBy;
        } else {
            this.sortInfo = [sortBy];
        }
    }

    get sortBy() {
        return this.isSortMulti ? this.sortInfo : this.sortInfo[0];
    }

    get tableContainerClass() {
        return this.scrollable ? 'slds-scrollable--y table-box-scroller' : '';
    }

    _cellMatrixNotTracked = {};

    @track
    _cellMatrix = {};
    @track
    _definedRows = {};
    @track
    sortInfo = [{}];
    @track
    isScrollBottom = false;

    static BASIC_ROW_CONFIG = {
        hoverHorizontalHighlight: true
    };

    static BASIC_ACTIONS_CONFIG = {
        // both works
        identity: '',
        position: 'append',
        status: 'hidden', // 'always', 'hover', 'hoverOnRow'
        describe: '',
        type: 'icon', // 'button-icon', 'button', 'dynamic-icon'
        icon: 'utility:info',
        // icon works
        size: 'xx-small',
        iconVariant: '', // 'info','success','warning','error'
        iconClass: '',
        // button works
        buttonVariant: '', // 'neutral', 'brand', 'outline-brand', 'destructive', 'text-destructive', 'success'
        buttonIconVariant: '', // ''
        tooltip: '',
        disabled: false,
        iconPosition: '',
        content: '',
        // 'dynamic-icon'
        dynamicType: '',
        dynamicOption: ''
    };

    static COMPUTED_COLUMN_TEMPLATE = {
        // do not computed
        field: '',
        displayField: '',
        // do computed
        header: {
            width: '',
            label: '',
            helpInfo: '',
            usingHelpInfo: false,
            align: 'left',
            helpIcon: 'utility:info',
            helpVariant: 'bare',
            helpPosition: 'append', // insertBefore, start, end
            isCustomHelpInfo: false,
            sortable: false,
            tooltips: [],
            // eg.
            // [{
            //     info:'test',
            //     variant:'bare',
            //     icon:'utility:info',
            //     position:'append',
            // }]
            // un reached
            isWrap: false
        },
        cell: {
            align: 'left',
            cellClass: '',
            type: 'text',
            cellType: 'basic',
            url: '',
            usingUrl: false,
            computedValue: '',
            doCompute: false,
            cellTip: '',
            editable: false,
            hasCellTip: false,
            cellTipIcon: 'utility:info',
            cellTipVariant: 'bare',
            cellTipPosition: 'append', // insertBefore, start, end
            isCustomCellTip: false,
            editIconPosition: 'append',
            isWrap: false,
            referenceAPI: '',
            picklistOptions: [],// {label: , value: }
            percentFixed: false,
            isEditing: false,
            disabled: false,
            buttonVariant: 'neutral',
            background: '',
            shownOnHover: false,
            shownOnHoverAlign: 'left', // 'right', 'left', 'auto'
            hoverVerticalHighlight: false,
            autoSave: false,
            actions: [
                Table.BASIC_ACTIONS_CONFIG
            ],
            lineHeight: 'normal',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            textColor: '',
            hasTitle: false,
            title: '',
            hasAvatar: false,
            avatarUrl: '',
            // pre do
            usingFormula: false,
            formula: '',
            defaultValue: ''
        },
        callback: {
            onclick({ column, row, index, data }) {
            },
            onEdit({ cell, standard }) {
                return standard;
            },
            onEditSubmit({ value, cell, row, displayValue }) {
                if (cell && cell.field) {
                    row[cell.field] = value;
                }
                return true;
            },
            onUrlClick({ event, url, row, column, index, data }) {
            },
            onExpandChanged({ row, cell, isExpand }) {
                return true;
            },
            onValueChanged({ cell, row, extra }) {
            },
            onButtonClick({ cell, row }) {
            },
            onMouseIn({ styleMap, rKeyMap, cKeyMap, rIndex, cIndex, row, rows }) {
            },
            onMouseOut({ styleMap, rKeyMap, cKeyMap, rIndex, cIndex, row, rows }) {
            },
            onActionClick() {
            }
        }
    };

    static TREE_ROWS_TEMPLATE = {
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
        childNodes: undefined
    };

    static TYPE_MAPPER = {
        boolean: { type: 'checkbox' },
        combobox: { type: 'text' },
        date: { type: 'date' },
        time: { type: 'time' },
        datetime: { type: 'datetime' },
        email: { type: 'email' },
        long: {
            type: 'number', option: {
                step: 1
            }
        },
        double: {
            type: 'number',
            option: {
                step: 0.01
            }
        },
        integer: {
            type: 'number', option: {
                step: 1
            }
        },
        percent: {
            type: 'number',
            option: {
                formatter: 'percent'
            }
        },
        currency: {
            type: 'number',
            option: {
                formatter: 'currency'
            }
        },
        multipicklist: { type: 'multipicklist' },
        phone: { type: 'tel' },
        picklist: { type: 'picklist' },
        reference: { type: 'reference' },
        textarea: { type: 'textarea' },
        url: { type: 'url' }
    };

    init() {
        loadStyle(this, Resource + '/css/date-picker-repaired.css')
            .then(res => {
                console.log('success');
            })
            .catch(e => {
                console.log(e);
            });
    }

    renderedCallback() {
        super.renderedCallback();
        if (this.scrollable && this.infiniteLoading) {
            Utils.waitTodo(0).then(res => {
                this.checkForLoadMore(
                    this.template.querySelector('.table-box-scroller'),
                    this.template.querySelector('.slds-table.header-fixed'),
                    10, true
                );
            });
        }
    }

    /**
     * Make sure all rows have the keyField,
     * If a row has none keyField, assign the keyField as index.
     * @returns []
     */
    get keyRows() {
        return (this.rows || [])
            .map((row, index) => ({ [this.keyField]: index + '', ...row }))
            .map(row => ({ ...Table.BASIC_ROW_CONFIG, ...row, ...{ _identity: row[this.keyField] } }));
    }

    get tableBoxClass() {
        let classes = [
            'table-box',
            this.scrollable ? 'header-fixed' : '',
            this.scrollable ? 'slds-table_header-fixed_container' : ''
        ];
        return classes.filter(c => c).join(' ').trim();
    }

    get tableClass() {
        let classes = [
            'slds-table',
            !this.noRowBorder ? 'slds-table_bordered' : '',
            'slds-table_fixed-layout',
            !this.noColumnBorder ? 'slds-table_col-bordered' : '',
            'no-padding-cell',
            this.autoWidth ? 'auto-width' : '',
            this.showColumnHighlight ? 'hide-overflow' : '',
            this.scrollable ? 'header-fixed' : '',
            this.scrollable ? 'slds-table_header-fixed' : ''
        ];
        return classes.filter(c => c).join(' ').trim();
    }

    get tableBoxStyle() {
        return [
            this.scrollable ? `max-height:${this.height}px` : '',
            `min-height: ${this.minHeight}px`,
            'background: white'
        ].join(';');
    }

    get hasEditorActionButton() {
        return this.usingSaveAll
            && Object.values(this._cellMatrix).filter(cells => {
                return Object.values(cells).filter(cell => cell.isEdit).length > 0;
            }).length > 0;
    }

    changeSortHandler(e) {
        const target = e.currentTarget;
        const field = target.getAttribute('data-row-field');
        const sortable = Utils.convertBoolean(target.getAttribute('data-sortable'));
        const currentSortBy = this.sortBy;
        if (field && !this.isSortMulti && sortable) {
            if (currentSortBy.field === field) {
                this.sortBy = { ...currentSortBy, isDesc: !currentSortBy.isDesc };
            } else {
                this.sortBy = { field: field, isDesc: true };
            }
            this.dispatchEvent(new CustomEvent('sort', { detail: { sortBy: this.sortBy } }));
        }
    }

    handleScroll(e) {
        const ele = e.currentTarget;
        const tableEle = this.template.querySelector('.slds-table.header-fixed');
        this.checkForLoadMore(ele, tableEle);
    }

    checkForLoadMore(boxElement, contentElement, checkOffset = 20, isInit = false) {
        if (boxElement && contentElement && this.infiniteLoading) {
            const offsetHeight = contentElement.offsetHeight;
            const scrollTop = boxElement.scrollTop;
            const boxHeight = boxElement.offsetHeight;
            if (scrollTop + boxHeight >= offsetHeight - checkOffset && !this.isScrollBottom) {
                if (!isInit) {
                    this.isScrollBottom = true;
                }
                this.whileLoadMore({ offsetHeight, boxHeight, scrollTop });
            }
            if (scrollTop + boxHeight < offsetHeight - checkOffset) {
                this.isScrollBottom = false;
            }
        }
    }

    whileLoadMore({ offsetHeight, boxHeight, scrollTop }) {
        this.dispatchEvent(new CustomEvent('loadmore', {
            detail: { offsetHeight, boxHeight, scrollTop }
        }));
    }

    preventEvent(e) {
        e.cancelBubble = true;
        e.stopPropagation();
    }

    @api
    saveAll() {
        let editCells = [];
        this.forInCellMatrixNotTracked(({ cell }) => {
            if (cell.isEdit) {
                editCells.push({ ...cell });
            }
        });
        // console.log(editCells);
        this.dispatchEvent(new CustomEvent('save', { detail: { editCells } }));
        this.cancelSave();
    }

    cancelSave() {
        this.forInCellMatrix(({ rKey, cKey }) => {
            this.cellInMatrix[rKey][cKey].isEdit = false;
            this.cellInMatrix[rKey][cKey].hasWaitingBackground = false;
            this.cellInMatrix[rKey][cKey].isWaiting = false;
        });
    }

    forInCellMatrixNotTracked(cb) {
        Object.entries(this._cellMatrixNotTracked).forEach(([rKey, row]) => {
            if (row) {
                Object.entries(row).forEach(([cKey, cell]) => {
                    cb.call(this, { cell, rKey, cKey });
                });
            }
        });
    }

    forInCellMatrix(cb) {
        Object.entries(this._cellMatrix).forEach(([rKey, row]) => {
            if (row) {
                Object.entries(row).forEach(([cKey, cell]) => {
                    cb.call(this, { cell, rKey, cKey });
                });
            }
        });
    }

    get definedRows() {
        return Utils.getProxyChain(
            this._definedRows,
            ({ origin: [target, name, value], info: { parentNames } }) => {
                let definedRowsCopy = { ...this._definedRows };
                Utils.setProperty(definedRowsCopy, [...parentNames, name], value);
                this._definedRows = definedRowsCopy;
            },
            false
        );
    }

    get cellInMatrix() {
        return Utils.getProxyChain(
            this._cellMatrix,
            ({ origin: [target, name, value], info: { parentNames } }) => {
                let cellMatrixCopy = { ...this._cellMatrix };
                Utils.setProperty(cellMatrixCopy, [...parentNames, name], value);
                this._cellMatrix = cellMatrixCopy;
            },
            false
        );
    }

    get cellInMatrixNotTracked() {
        return Utils.getProxyChain(
            this._cellMatrixNotTracked,
            ({ origin: [target, name, value], info: { parentNames } }) => {
                let cellMatrixCopy = { ...this._cellMatrixNotTracked };
                Utils.setProperty(cellMatrixCopy, [...parentNames, name], value);
                this._cellMatrixNotTracked = cellMatrixCopy;
            },
            false
        );
    }

    get computedColumns() {
        // get header config using computing.
        let widthCount = 0;
        const widthList = [];
        const results = this.columns.map((column, i) => [column.field || '', column.header || null, i])
            .map(([field, header, i]) => {
                // console.log(field);
                let headerConfig = parseObjectFields({
                    ...Table.COMPUTED_COLUMN_TEMPLATE.header,
                    ...header,
                    symbol: `columns - ${i}`
                }, ...[this, { field, rows: this.keyRows }]);
                headerConfig.hasWidth = headerConfig.width != null && headerConfig.width.trim() !== '';
                headerConfig.style = headerConfig.hasWidth ? `width: ${headerConfig.width}` : 'width: auto;';
                if (headerConfig.hasWidth) {
                    widthCount++;
                    widthList.push(headerConfig.width);
                }
                headerConfig.field = field;
                headerConfig.tooltips = [...headerConfig.tooltips, {
                    icon: headerConfig.helpIcon,
                    position: headerConfig.helpPosition,
                    info: headerConfig.helpInfo,
                    variant: headerConfig.helpVariant,
                    isCustom: headerConfig.isCustomHelpInfo
                }];

                const resultTooltips = headerConfig.tooltips.map((tooltip, i) => ({
                    ...tooltip,
                    position: parsePosition(tooltip.position, tooltip.info),
                    key: `tooltip key ${i}`
                }));

                const hasEnd = !!resultTooltips.find(t => t.position.isEnd);
                const hasStart = !!resultTooltips.find(t => t.position.isStart);

                let thClassArr = [
                    hasEnd ? 'has-cell-end' : '',
                    hasStart ? 'has-cell-start' : '',
                    '_align-' + headerConfig.align
                ];
                headerConfig.innerClass = [
                    this.scrollable ? 'slds-cell-fixed' : '',
                    'slds-th__action cell-action slds-text-link_reset'
                ].join(' ');
                headerConfig.thClass = thClassArr.join(' ').trim();
                if (headerConfig.sortable && !this.isSortMulti) {
                    headerConfig.showSort = this.sortBy.field === field;
                    headerConfig.sortIcon = this.sortBy.isDesc ? 'utility:arrowdown' : 'utility:arrowup';
                    const sortClasses = [
                        'slds-icon_container',
                        this.sortBy.isDesc ? 'slds-icon-utility-arrowdown' : 'slds-icon-utility-arrowup'
                    ];
                    headerConfig.sortClass = sortClasses.join(' ').trim();
                }
                // console.log(headerConfig);
                return { ...headerConfig, resultTooltips };
            });
        return results.map(r => {
            if (!this.scrollable) {
                return r;
            }
            return {
                ...r,
                innerStyle: `width: ${r.hasWidth ? r.width : `calc((100% - (${widthList.join(' + ') || '0px'})) / ${(results.length - widthCount) || 1})`}`
            };
        });
    }

    get treeRows() {
        let keyField = this.keyField;
        let rows = this.keyRows.map(row => ({ ...row }))
            .map((row, index) => parseObject({ ...Table.TREE_ROWS_TEMPLATE, ...row }, this, {
                row, index, rows: this.keyRows
            }));
        rows.forEach(
            row => {
                if (row.parentName == null || row.parentName === '' || row.parentName === row[keyField]) {
                    row.isRoot = true;
                } else {
                    if (row.parentName) {
                        row.parentNode = rows.find(r => r[keyField] === row.parentName && r[keyField] !== row[keyField]);
                        if (row.parentNode && !row.parentNode.childNodes) {
                            row.parentNode.childNodes = [];
                        }
                        if (row.parentNode) {
                            const pChildNodes = row.parentNode.childNodes;
                            if (!pChildNodes.find(node => node[keyField] === row[keyField])) {
                                pChildNodes.push(row);
                            }
                        }
                        row.isRoot = !row.parentNode;
                    }
                }
            }
        );
        rows.forEach(row => {
            row.childrenNum = (row.childNodes || []).length;
            row.hasChildren = !!row.childrenNum;
            row.hasParent = !!row.parentNode;
            let indent = 0;
            let element = row;
            while (element.parentNode) {
                indent++;
                element = element.parentNode;
                if (!element.parentNode) {
                    row.rootParent = element;
                }
            }
            row.indent = indent;
        });
        let resultRows = [];
        rows.filter(row => row.isRoot).forEach(row => {
            resultRows.push(row);
            preOrderTraversalTree(row, r => {
                resultRows.push(r);
            });
        });
        resultRows.forEach(row => {
            row.isShow = row.isRoot || (row.parentNode.isShow && row.parentNode.isExpand) || (row.parentNode.isRoot && row.parentNode.isExpand);
            row.showExpand = row.hasChildren || row.canExpand;
        });
        return resultRows;
    }

    get computedRows() {
        if (!this.hasInit) {
            return [];
        }
        let keyField = this.keyField;
        return (this.usingTree ? this.treeRows : this.keyRows).map((row, rIndex, rows) => {
            // tree info
            let treeInfo;
            if (this.usingTree) {
                treeInfo = Utils.fromEntries(
                    Object.keys(Table.TREE_ROWS_TEMPLATE).map(key => [key, row[key]])
                );
            }
            if (treeInfo && !treeInfo.isRoot && !treeInfo.isShow) {
                return null;
            }
            return {
                cells: this.columns
                    .map(column => ({ ...Table.COMPUTED_COLUMN_TEMPLATE, ...column }))
                    .map((column, i) => [column.callback, column.field || '', column.displayField || '', column.cell || null, i])
                    .map(([callback, field, displayField, cell, cIndex]) => {
                        const fieldValue = row[field];
                        const displayValue = row[displayField];
                        const cellConfig = parseFunctionFields({
                            ...Table.COMPUTED_COLUMN_TEMPLATE.cell, ...(Utils.fromEntries(
                                Object.entries(cell).filter(([key, value]) => value != null)
                            ))
                        });

                        const extra = this.cellInMatrix[row[keyField]][cIndex];
                        const typeMapper = Table.TYPE_MAPPER;
                        const resultInfo = {
                            fieldValue, displayValue, field, index: rIndex, cIndex: cIndex, displayField,
                            [keyField]: row[keyField], rowIdentity: row[keyField], keyField, extra
                        };
                        const params = { row, index: rIndex, rows: rows, field };
                        const getCallback = method => callback[method] || Table.COMPUTED_COLUMN_TEMPLATE.callback[method];
                        callback = callback || {};

                        Helper.generateComputedValue(resultInfo, params, cellConfig);
                        Helper.generateUrlInfo(resultInfo, params, cellConfig, { getCallback, context: this });
                        Helper.generateTipInfo(resultInfo, params, cellConfig);
                        Helper.generateTypeInfo(resultInfo, params, cellConfig, { getCallback, context: this });
                        Helper.generateEditorInfo(resultInfo, params, cellConfig, {
                            getCallback, context: this, typeMapper
                        });
                        Helper.generateTreeInfo(resultInfo, params, cellConfig, {
                            getCallback, context: this, treeInfo
                        });
                        Helper.generateActionInfo(resultInfo, params, cellConfig, {
                            getCallback, context: this,
                            basicConfig: Table.BASIC_ACTIONS_CONFIG
                        });
                        Helper.generateClassStyle(resultInfo, params, cellConfig, { getCallback, context: this });
                        Helper.onCellRenderedEnd(resultInfo, params, cellConfig, { context: this });

                        return resultInfo;
                    }),
                symbol: Symbol(`rows - ${rIndex}`),
                identity: row[keyField],
                rowClass: [
                    row.hoverHorizontalHighlight ? '' : 'none-highlight',
                    'slds-hint-parent'
                ].join(' ').trim()
            };
        }).filter(row => row != null);
    }
}