export default class Helper {

    static generateClassStyle(info, params, config, { context, getCallback }) {
        const align = config.align;
        const hoverVerticalHighlight = config.hoverVerticalHighlight;
        const padding = config.padding;
        const lineHeight = config.lineHeight;
        const height = config.height;
        const tdClassArr = [
            'slds-is-relative',
            '_align-' + align,
            context.showColumnHighlight && hoverVerticalHighlight ? 'column-highlight' : ''
        ];
        const tdStyles = [
            padding.top ? 'padding-top: ' + padding.top + 'rem' : '',
            padding.right ? 'padding-right: ' + padding.right + 'rem' : '',
            padding.bottom ? 'padding-bottom: ' + padding.bottom + 'rem' : '',
            padding.left ? 'padding-left: ' + padding.left + 'rem' : '',
            'line-height: ' + lineHeight,
            'height: ' + height
        ];
        const background = config.background;
        const textColor = config.textColor;
        if (background) {
            tdStyles.push(`background: ${background}`);
        }
        if (textColor) {
            tdStyles.push(`color: ${textColor}`);
        }
        const tdClass = tdClassArr.join(' ').trim();

        const classStyleInfo = {
            tdClass, style: tdStyles.join(';')
        };


        Object.assign(info, classStyleInfo);
    }

    static onCellRenderedEnd(info, params, config, { context }) {
        const { cIndex, keyField, fieldValue } = info;
        Object.assign(info, {
            symbol: `cells - [${info[keyField]},${cIndex}]`
        });

    }
}