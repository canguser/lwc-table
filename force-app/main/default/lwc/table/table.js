/**
 * Created by ryan on 2019-07-25.
 */

import { api, track } from 'lwc';
import LifecycleElement from 'c/lifecycleElement';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
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
import LocalCacheService from 'c/localCacheService';

export default class Table extends LifecycleElement {

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
    @api maxRows = 10;
    @api minRows = 0;
    @api minHeight = 0;
    @api infiniteLoading = false;
    @api isGraphTree = false;
    @api delayRender = false;
    @api renderedImmediately = false;

    delayLoaded = false;

    @api
    set loadedAll(value) {
        if (value !== this._loadedAll) {
            this.isScrollBottom = false;
        }
        this._loadedAll = value;
    }

    _loadedAll = false;

    get loadedAll() {
        return this._loadedAll;
    }

    get isLoading() {
        return super.isLoading || !this.delayLoaded;
    }

    // unreached.
    @api selectable = false;
    @api isMultipleSelected = false;
    @api className = '';
    @track
    sortInfo = [{}];

    rowOffset = 7;

    rowHeight = 32;

    _startRow = 0;

    _viewStartRow = 0;

    @track
    _columns = [];
    @track
    _rows = [];

    columnsHashcode = '';
    rowsHashcode = '';
    tableIdentity = Utils.genID(7);

    @api set columns(columns) {
        const hashcode = Utils.getHashCode(columns);
        if (this.columnsHashcode !== hashcode) {
            this._columns = columns;
            this.columnsHashcode = hashcode;
        }
    }

    @api set rows(rows) {
        const hashcode = Utils.getHashCode(rows);
        if (this.rowsHashcode !== hashcode) {
            console.log('rows refreshed...');
            this._rowsNotTrack = rows;
            this.rowsHashcode = hashcode;
            if (this.hasInit) {
                this._assignRows();
            }
        }
    }

    _assignRows() {
        if (this.delayRender) {
            this._delayRenderRows().catch(e => this.handleError(e));
        } else {
            this._rows = this._rowsNotTrack;
        }
    }

    async _delayRenderRows() {
        await Utils.delay(this, 'delayRows', 150);
        const deployContainer = LocalCacheService.getDeployContainer('table');
        console.log('delay render table...');
        this.delayLoaded = false;
        await deployContainer.waitDelay(
            () => {
                this.delayLoaded = true;
                this._rows = this._rowsNotTrack;
            }
        );
    }

    get viewingRowsNum() {
        return this.maxRows;
    }

    get columns() {
        return this._columns;
    }

    get rows() {
        return this._rows;
    }

    get rowHeightStyle() {
        return [
            `height: ${this.rowHeight}px`
        ].join(';');
    }

    get _endRow() {
        return this._viewStartRow + this.viewingRowsNum;
    }

    get endRow() {
        return this._endRow + this.rowOffset;
    }

    get startRow() {
        return this._startRow - this.rowOffset;
    }

    get maxTableHeight() {
        return this.maxRows * (this.rowHeight + 1);
    }

    get minTableHeight() {
        return this.minRows * (this.rowHeight + 1);
    }

    get sortBy() {
        return this.isSortMulti ? this.sortInfo : this.sortInfo[0];
    }

    @api
    set sortBy(sortBy) {
        if (this.isSortMulti) {
            this.sortInfo = sortBy;
        } else {
            this.sortInfo = [sortBy];
        }
    }

    get tableContainerClass() {
        return this.scrollable ? 'slds-scrollable--y table-box-scroller' : '';
    }

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
            urlValue: '',
            computedValue: '',
            doCompute: false,
            cellTip: '',
            editable: false,
            hasCellTip: false,
            cellTipIcon: 'utility:info',
            cellTipVariant: 'bare',
            cellTipPosition: 'append', // insertBefore, start, end
            cellPopoverTitle: '',
            cellPopoverBody: '',
            cellPopoverPosition: 'auto', //
            showCellPopover: false,
            isCustomCellTip: false,
            editIconPosition: 'end',
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
            shownOnHoverMaxWidth: '20rem',
            shownOnHoverMinWidth: '100%',
            shownOnHoverNowrap: true,
            hoverVerticalHighlight: false,
            autoSave: false,
            actions: [
                Table.BASIC_ACTIONS_CONFIG
            ],
            lineHeight: 'normal',
            height: 'auto',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            textColor: '',
            textStyle: '',
            hasTitle: false,
            title: '',
            hasAvatar: false,
            avatarUrl: '',
            isOuterEditor: undefined,
            textareaExpand: false,
            renderedImmediately: false,
            percentUnit: '%',
            percentDecimal: 0,

            editorHelperText: '',

            customizeType: '',

            // customizeType = 'avatar-desc'
            describe: '',

            // customizeType = 'process-bar'
            progressPercent: 0,
            progressTitle: '',

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

    static NOT_COPY_TREE_FIELD = ['parentNode', 'rootParent', 'childNodes'];

    get copyValidTreeField() {
        return Object.keys(Table.TREE_ROWS_TEMPLATE)
            .filter(field => !Table.NOT_COPY_TREE_FIELD.includes(field));
    }

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
        this._assignRows();
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
        // console.timeEnd('rendered table');
        if (this.scrollable && this.infiniteLoading && !this.loadedAll && (!this.delayRender || this.delayLoaded)) {
            Utils.delay(this, 'checkLadingMore', 10).then(() => {
                this.checkForLoadMore(
                    this.template.querySelector('.table-box-scroller'),
                    this.template.querySelector('.slds-table.header-fixed'),
                    10, true
                );
            });
        }
    }

    get canCheckInfiniteLoading() {
        return this.scrollable && this.infiniteLoading;
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
            this.scrollable ? `max-height:${this.maxTableHeight}px` : '',
            `min-height: ${this.minTableHeight}px`,
            'background: white'
        ].join(';');
    }

    get hasEditorActionButton() {
        return this.usingSaveAll
            && Object.values(this.cellsInfo).filter(cell => cell.isEdit).length > 0;
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
        // check to render more
        if (this.scrollable) {
            const ele = e.currentTarget;
            const tableEle = this.template.querySelector('.slds-table.header-fixed');
            this.checkForLoadMore(ele, tableEle);
            Utils.delay(this, 'scrollto', 150)
                .then(() => {
                    const toRow = parseInt((ele.scrollTop || 0) / (this.rowHeight || 0), 10);
                    if (toRow > this._viewStartRow) {
                        this._viewStartRow = toRow;
                    }
                });
        }
    }

    checkForLoadMore(boxElement, contentElement, checkOffset = 32 * 5, isInit = false) {
        if (boxElement && contentElement && this.infiniteLoading) {
            const offsetHeight = contentElement.offsetHeight;
            const scrollTop = boxElement.scrollTop;
            const boxHeight = boxElement.offsetHeight;

            const currentScrollBottom = scrollTop + boxHeight;

            // console.log(currentScrollBottom, offsetHeight, checkOffset);

            if (currentScrollBottom >= offsetHeight - checkOffset && !this.isScrollBottom) {
                if (!isInit) {
                    this.isScrollBottom = true;
                }
                this.whileLoadMore({ offsetHeight, boxHeight, scrollTop });
            }
            if (currentScrollBottom < offsetHeight - checkOffset) {
                this.isScrollBottom = false;
            }
        }
    }

    @api continueLoadMore() {
        // console.log('allow loading more');
        this.isLoadMoreEventPending = false;
        this.isScrollBottom = false;
    }

    whileLoadMore({ offsetHeight, boxHeight, scrollTop }) {
        if (!this.isLoadMoreEventPending) {
            this.isLoadMoreEventPending = true;
            this.dispatchEvent(new CustomEvent('loadmore', {
                detail: { offsetHeight, boxHeight, scrollTop, target: this }
            }));
        }
    }

    preventEvent(e) {
        e.cancelBubble = true;
        e.stopPropagation();
    }

    @api
    saveAll() {
        let editCells = Object.values(this.cellsInfo)
            .filter(cell => cell.isEdit && cell.initialed)
            .map(cell => ({ ...cell.get('extra') }));
        console.log('editCells', editCells);
        this.dispatchEvent(new CustomEvent('save', { detail: { editCells } }));
        this.cancelSave();
    }

    cancelSave() {
        Object.values(this.cellsInfo).forEach(cell => {
            if (cell && cell.get) {
                const cancelEdit = cell.get('cancelEdit');
                cancelEdit();
            }
        });
    }

    needShow(rowIndex) {
        return /*rowIndex >= this.startRow && rowIndex <= this.endRow*/true || !this.scrollable;
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
        console.time('compute tree rows');
        let keyField = this.keyField;

        let keyRows = this.keyRows;

        if (this.isGraphTree) {
            const allRowsIdentity = [];
            keyRows = keyRows.reverse().reduce((rows, row) => {
                if (!allRowsIdentity.includes(row[this.keyField])) {
                    rows.push(row);
                    allRowsIdentity.push(row[this.keyField]);
                }
                return rows;
            }, []).reverse();
        }

        let rows = keyRows.map(row => ({ ...row }))
            .map((row, index) => parseObject({ ...Table.TREE_ROWS_TEMPLATE, ...row }, this, {
                row, index, rows: keyRows
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
        console.timeEnd('compute tree rows');
        return resultRows;
    }

    get computedRows() {
        if (!this.hasInit) {
            return [];
        }
        // console.time('loaded table');
        // console.time('rendered table');
        let keyField = this.keyField;
        let resultRows = (this.usingTree ? this.treeRows : this.keyRows).map((row, rIndex, rows) => {
            // tree info
            let treeInfo;
            if (this.usingTree) {
                treeInfo = Utils.fromEntries(
                    this.copyValidTreeField.map(key => [key, row[key]])
                );
            }
            if (treeInfo && !treeInfo.isRoot && !treeInfo.isShow) {
                return null;
            }
            return {
                cells: this.columns
                    .map(column => ({ ...Table.COMPUTED_COLUMN_TEMPLATE, ...column }))
                    .map((column, i) => {
                        return [method => ({ ...Table.COMPUTED_COLUMN_TEMPLATE.callback, ...column.callback } || {})[method], column.field || '', column.displayField || '', column.cell || null, i];
                    })
                    .map(([getCallback, field, displayField, cell, cIndex, i]) => {
                        if (!this.needShow(rIndex)) {
                            return {
                                hide: true,
                                symbol: `cells - [${row[keyField]},${cIndex}]`,
                                style: this.rowHeightStyle,
                                dblclick: () => undefined
                            };
                        }
                        const fieldValue = row[field];
                        const displayValue = row[displayField];
                        const cellConfig = {
                            ...Table.COMPUTED_COLUMN_TEMPLATE.cell,
                            ...(Utils.fromEntries(
                                Object.entries(cell).filter(([, value]) => value != null)
                            )),
                            row, index: rIndex, rows: rows, field
                        };

                        const cellProxy = Utils.getReferenceProxy(cellConfig);

                        const resultInfo = {
                            fieldValue, displayValue, field, index: rIndex, cIndex: cIndex, displayField,
                            [keyField]: row[keyField], rowIdentity: row[keyField], keyField
                        };
                        Helper.generateClassStyle(resultInfo, {}, cellProxy, { getCallback, context: this });
                        Helper.onCellRenderedEnd(resultInfo, {}, cellProxy, { context: this });

                        resultInfo.basicActionConfig = Table.BASIC_ACTIONS_CONFIG;
                        resultInfo.getCellConfigs = () => cellConfig;
                        resultInfo.sendParents = (api, params) => {
                            this.receiveFromCell(api, params);
                        };
                        Object.assign(resultInfo, {
                            getCallback,
                            getThisRow: (identity) => Utils.reflectClone(this.keyRows.find(row => row[keyField] === identity)),
                            getKeyRows: () => Utils.reflectClone(this.keyRows)
                        });
                        resultInfo.getContextProperty = propertyName => this[propertyName];
                        resultInfo.tableIdentity = this.tableIdentity;
                        resultInfo.renderedImmediately = this.renderedImmediately || cellProxy.renderedImmediately;
                        if (this.usingTree) {
                            Object.assign(resultInfo, treeInfo);
                            for (const field of Table.NOT_COPY_TREE_FIELD) {
                                row[field] = undefined;
                            }
                        }
                        return resultInfo;
                    }),
                symbol: Symbol(`rows - ${rIndex}`),
                identity: row[keyField],
                rowClass: [
                    row.hoverHorizontalHighlight ? '' : 'none-highlight',
                    'slds-hint-parent'
                ].join(' ').trim(),
                row
            };
        }).filter(row => row != null);

        resultRows.forEach(row => {
            // console.time('getCellHash');
            const hashCode = Utils.getHashCode([row.row, this.columns], false, 5);
            // console.timeEnd('getCellHash');
            row.cells.forEach(
                cell => {
                    cell.cellHashcode = hashCode;
                }
            );
        });

        if (this.scrollable) {
            this.queueTasks({
                action: () => {
                    const tdEle = this.template.querySelector('td');
                    if (tdEle) {
                        if (this.rowHeight !== tdEle.offsetHeight) {
                            this.rowHeight = tdEle.offsetHeight;
                        }
                    }
                    return true;
                }
            });

        }

        // console.timeEnd('loaded table');


        return resultRows;
    }

    //////////////////////////////
    // with cells items
    //////////////////////////////

    receiveFromCell(api, params) {
        const apiStrategy = Utils.generateStrategyMapper({
            'doEditing': this.whileCellDoEditing,
            'cancelEditing': this.whileCellCancelEditing,
            'cellInitialed': this.whileCellInitialed,
            'destroy': this.whileCellDestroyed
        }, e => e);
        apiStrategy[api].bind(this)(params);
    }

    @track
    cellsInfo = {};

    whileCellDoEditing({ index, rowIdentity, cIndex }) {
        const key = [index, cIndex, rowIdentity].join('-');
        let cellInfo = this.cellsInfo[key] || {};
        if (!cellInfo.isEdit) {
            cellInfo = {
                ...cellInfo,
                isEdit: true
            };
        }
        this.cellsInfo = {
            ...this.cellsInfo,
            [key]: cellInfo
        };
    }

    whileCellCancelEditing({ index, rowIdentity, cIndex }) {
        const key = [index, cIndex, rowIdentity].join('-');
        let cellInfo = this.cellsInfo[key] || {};
        if (cellInfo.isEdit) {
            cellInfo = {
                ...cellInfo,
                isEdit: false
            };
        }
        this.cellsInfo = {
            ...this.cellsInfo,
            [key]: cellInfo
        };
    }

    whileCellInitialed({ index, rowIdentity, cIndex, get }) {
        const key = [index, cIndex, rowIdentity].join('-');
        let cellInfo = this.cellsInfo[key] || {};
        if (!cellInfo.initialed) {
            cellInfo = {
                ...cellInfo,
                initialed: true,
                get
            };
        }
        this.cellsInfo = {
            ...this.cellsInfo,
            [key]: cellInfo
        };
    }

    whileCellDestroyed({ index, rowIdentity, cIndex }) {
        const key = [index, cIndex, rowIdentity].join('-');
        let cellsInfo = { ...this.cellsInfo };
        cellsInfo[key] = undefined;
        delete cellsInfo[key];
        this.cellsInfo = cellsInfo;
    }


}