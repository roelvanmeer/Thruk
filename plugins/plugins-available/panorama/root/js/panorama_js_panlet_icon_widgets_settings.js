TP.iconTypesStore = Ext.create('Ext.data.Store', {
    fields: ['name', 'value', 'icon'],
    autoLoad: false,
    data : [{value:'TP.HostStatusIcon',         name:'Host',               icon:url_prefix+'plugins/panorama/images/server.png'},
            {value:'TP.HostServicesStatusIcon', name:'Host with Services', icon:url_prefix+'plugins/panorama/images/server.png'},
            {value:'TP.HostgroupStatusIcon',    name:'Hostgroup',          icon:url_prefix+'plugins/panorama/images/server_link.png'},
            {value:'TP.ServiceStatusIcon',      name:'Service',            icon:url_prefix+'plugins/panorama/images/computer.png'},
            {value:'TP.ServicegroupStatusIcon', name:'Service Group',      icon:url_prefix+'plugins/panorama/images/computer_link.png'},
            {value:'TP.FilterStatusIcon',       name:'Custom Filter',      icon:url_prefix+'plugins/panorama/images/page_find.png'},
            {value:'TP.SiteStatusIcon',         name:'Site Status',        icon:url_prefix+'plugins/panorama/images/accept.png'},
            {value:'TP.DashboardStatusIcon',    name:'Dashboard Status',   icon:url_prefix+'plugins/panorama/images/map.png'}
    ]
});

TP.iconSettingsWindow = undefined;
TP.iconShowEditDialog = function(panel) {
    panel.stateful = false;
    var tab      = panel.tab;
    var lastType = panel.xdata.appearance.type;
    TP.iconShowEditDialogPanel = panel;

    // make sure only one window is open at a time
    if(TP.iconSettingsWindow != undefined) {
        TP.iconSettingsWindow.destroy();
    }
    if(TP.iconTip) { TP.iconTip.hide(); }
    tab.disableMapControlsTemp();

    TP.resetMoveIcons();
    TP.skipRender = false;

    TP.iconSettingsGlobals = {
        renderUpdate       : Ext.emptyFn,
        stateUpdate        : Ext.emptyFn,
        popupPreviewUpdate : Ext.emptyFn
    };
    // ensure fresh and correct performance data
    TP.iconSettingsGlobals.perfDataUpdate = function() {

        var xdata = TP.get_icon_form_xdata(settingsWindow);
        // update speedo
        var dataProblems = [];
        var cls = panel.classChanged || panel.xdata.cls;
        if(cls == "TP.HostgroupStatusIcon" || cls == "TP.ServicegroupStatusIcon" || cls == "TP.FilterStatusIcon") {
            dataProblems.push(['number of problems',                  'problems']);
            dataProblems.push(['number of problems (incl. warnings)', 'problems_warn']);
        }
        var macros = TP.getPanelMacros(panel);
        var dataPerf = [];
        for(var key in macros.perfdata) {
            var p = macros.perfdata[key];
            var r = TP.getPerfDataMinMax(p, '?');
            var options = sprintf("%.0f%s in %s - %s", p.val, p.unit, r.min, r.max);
            dataPerf.push(['Perf. Data: '+key+' ('+options+')', 'perfdata:'+key]);
        }
        /* use availability data as source */
        var dataAvail = [];
        if(xdata.label && xdata.label.labeltext && TP.availabilities && TP.availabilities[panel.id]) {
            var avail = TP.availabilities[panel.id];
            for(var key in avail) {
                var d = avail[key];
                var last    = d.last != undefined ? d.last : '...';
                if(last == -1) { last = '...'; }
                var options = d.opts['d'];
                if(d.opts['tm']) {
                    options    += '/'+d.opts['tm'];
                }
                dataAvail.push(['Availability: '+last+'% ('+options+')', 'avail:'+key]);
            }
        }
        var cbo = Ext.getCmp('speedosourceStore');
        TP.updateArrayStoreKV(cbo.store, [].concat(dataProblems, dataPerf, dataAvail));

        // update shape source store
        var dataShape = [['fixed', 'fixed']];
        var cbo = Ext.getCmp('shapesourceStore');
        TP.updateArrayStoreKV(cbo.store, [].concat(dataShape, dataPerf));

        // update connector source store
        var cbo = Ext.getCmp('connectorsourceStore');
        TP.updateArrayStoreKV(cbo.store, [].concat(dataShape, dataPerf));

        // update trend icon source store
        var cbo = Ext.getCmp('trendsourceStore');
        TP.updateArrayStoreKV(cbo.store, dataPerf);
    };

    /* General Settings Tab */
    var generalItems = panel.getGeneralItems();
    if(generalItems != undefined && panel.xdata.cls != 'TP.StaticIcon') {
        generalItems.unshift({
            xtype:        'combobox',
            name:         'newcls',
            fieldLabel:   'Filter Type',
            displayField: 'name',
            valueField:   'value',
            store:         TP.iconTypesStore,
            editable:      false,
            listConfig : {
                getInnerTpl: function(displayField) {
                    return '<div class="x-combo-list-item"><img src="{icon}" height=16 width=16 style="vertical-align:top; margin-right: 3px;">{name}<\/div>';
                }
            },
            value: panel.xdata.cls,
            listeners: {
                change: function(This, newValue, oldValue, eOpts) {
                    if(TP.iconSettingsWindow == undefined) { return; }
                    TP.iconSettingsWindow.mask('changing...');
                    var key   = panel.id;
                    var xdata = TP.get_icon_form_xdata(settingsWindow);
                    var conf  = {xdata: xdata};
                    conf.xdata.cls = newValue;

                    panel.redrawOnly = true;
                    panel.destroy();

                    TP.timeouts['timeout_' + key + '_show_settings'] = window.setTimeout(function() {
                        TP.iconSettingsWindow.skipRestore = true;
                        /* does not exist when changing a newly placed icon */
                        if(TP.cp.state[key]) {
                            TP.cp.state[key].xdata.cls = newValue;
                        }
                        panel = TP.add_panlet({id:key, skip_state:true, tb:tab, autoshow:true, state:conf, type:newValue}, false);
                        panel.xdata = conf.xdata;
                        panel.classChanged = newValue;
                        TP.iconShowEditDialog(panel);
                        TP.cp.state[key].xdata.cls = oldValue;
                    }, 50);
                }
            }
        });
    }
    var generalTab = {
        title : 'General',
        type  : 'panel',
        hidden: generalItems != undefined ? false : true,
        items: [{
            xtype : 'panel',
            layout: 'fit',
            border: 0,
            items: [{
                    xtype:           'form',
                    id:              'generalForm',
                    bodyPadding:     2,
                    border:          0,
                    bodyStyle:       'overflow-y: auto;',
                    submitEmptyText: false,
                    defaults:      { anchor: '-12', labelWidth: panel.generalLabelWidth || 132, listeners: { change: function(This, newValue, oldValue, eOpts) { if(newValue != "") { TP.iconSettingsGlobals.stateUpdate() } } } },
                    items:           generalItems
            }]
        }]
    };

    var updateDisabledFields = function(xdata) {
        var originalRenderUpdate = TP.iconSettingsGlobals.renderUpdate;
        TP.iconSettingsGlobals.renderUpdate = Ext.emptyFn;
        Ext.getCmp('shapeheightfield').setDisabled(xdata.appearance.shapelocked);
        Ext.getCmp('shapetogglelocked').toggle(xdata.appearance.shapelocked);
        Ext.getCmp('pieheightfield').setDisabled(xdata.appearance.pielocked);
        Ext.getCmp('pietogglelocked').toggle(xdata.appearance.pielocked);
        if(xdata.appearance.type == "connector" || xdata.appearance.type == "none") {
            Ext.getCmp('rotationfield').setVisible(false);
        } else {
            Ext.getCmp('rotationfield').setVisible(true);
        }
        TP.iconSettingsGlobals.renderUpdate = originalRenderUpdate;
    };

    /* Layout Settings Tab */
    var layoutTab = {
        title: 'Layout',
        type:  'panel',
        items: [{
            xtype : 'panel',
            layout: 'fit',
            border: 0,
            items: [{
                xtype:           'form',
                id:              'layoutForm',
                bodyPadding:     2,
                border:          0,
                bodyStyle:       'overflow-y: auto;',
                submitEmptyText: false,
                defaults:      { anchor: '-12', labelWidth: 80 },
                items: [{
                    fieldLabel: 'Position',
                    xtype:      'fieldcontainer',
                    layout:     'table',
                    id:         'layoutFormPosition',
                    disabled:   (panel.xdata.appearance.type == 'connector'),
                    items: [{ xtype: 'label', text:  'x:', style: 'margin-left: 0; margin-right: 2px;', hidden: !!tab.map },
                            { xtype: 'numberfield', name:  'x', width: 70, value: panel.xdata.layout.x, hidden: !!tab.map, listeners: {
                                change: function(This, newValue, oldValue, eOpts) {
                                    if(!panel.noMoreMoves) {
                                        panel.noMoreMoves = true;
                                        var y = Number(This.up('panel').getValues().y);
                                        panel.setPosition(newValue, y);
                                        panel.noMoreMoves = false;
                                    }
                                }
                            }},
                            { xtype: 'label', text:  'y:', style: 'margin-left: 10px; margin-right: 2px;', hidden: !!tab.map },
                            { xtype: 'numberfield', name:  'y', width: 70, value: panel.xdata.layout.y, hidden: !!tab.map, listeners: {
                                change: function(This, newValue, oldValue, eOpts) {
                                    if(!panel.noMoreMoves) {
                                        panel.noMoreMoves = true;
                                        var x = Number(This.up('panel').getValues().x);
                                        panel.setPosition(x, newValue);
                                        panel.noMoreMoves = false;
                                    }
                                }
                            }},

                            { xtype: 'label', text:  'lat:', style: 'margin-left: 0px; margin-right: 2px;', hidden: !tab.map },
                            { xtype: 'numberfield', name:  'lat', width: 140, decimalPrecision: 14, value: panel.xdata.layout.lat, hidden: !tab.map, listeners: {
                                change: function(This, newValue, oldValue, eOpts) {
                                    if(!panel.noMoreMoves) {
                                        panel.noMoreMoves = true;
                                        var lon    = Number(This.up('panel').getValues().lon);
                                        var center = This.up('panel').getValues().center;
                                        panel.moveToMapLonLat(false, {layout:{lon: lon, lat: newValue, center: center}, appearance:{}, nsize: panel.xdata.nsize});
                                        panel.noMoreMoves = false;
                                    }
                                }
                            }},

                            { xtype: 'label', text:  'lon:', style: 'margin-left: 10px; margin-right: 2px;', hidden: !tab.map },
                            { xtype: 'numberfield', name:  'lon', width: 140, decimalPrecision: 14, value: panel.xdata.layout.lon, hidden: !tab.map, listeners: {
                                change: function(This, newValue, oldValue, eOpts) {
                                    if(!panel.noMoreMoves) {
                                        panel.noMoreMoves = true;
                                        var lat    = Number(This.up('panel').getValues().lat);
                                        var center = This.up('panel').getValues().center;
                                        panel.moveToMapLonLat(false, {layout:{lon: newValue, lat: lat, center: center}, appearance:{}, nsize: panel.xdata.nsize});
                                        panel.noMoreMoves = false;
                                    }
                                }
                            }}, {
                                name:         'center',
                                xtype:        'combobox',
                                store:        ['centered', 'bottom-center', 'bottom-left', 'bottom-right', 'top-center', 'top-left', 'top-right', 'center-left', 'center-right'],
                                editable:      false,
                                hidden:       !tab.map || panel.xdata.appearance.type == "connector",
                                width:        100,
                                listeners: {
                                    change: function(This, newValue, oldValue, eOpts) {
                                        if(!panel.noMoreMoves) {
                                            panel.noMoreMoves = true;
                                            var lat = Number(This.up('panel').getValues().lat);
                                            var lon = Number(This.up('panel').getValues().lon);
                                            panel.moveToMapLonLat(false, {layout:{lon: lon, lat: lat, center: newValue}, appearance:{}, nsize: panel.xdata.nsize});
                                            panel.noMoreMoves = false;
                                        }
                                    }
                                }
                            },

                            { xtype: 'label', text: '(use cursor keys)', style: 'margin-left: 10px;', cls: 'form-hint', hidden: !!tab.map }
                    ]
                }, {
                    fieldLabel:   'Rotation',
                    xtype:        'numberunit',
                    allowDecimals: false,
                    name:         'rotation',
                    id:           'rotationfield',
                    unit:         '°',
                    minValue:     -360,
                    maxValue:      360,
                    step:           15,
                    value:         panel.xdata.layout.rotation != undefined ? panel.xdata.layout.rotation : 0,
                    listeners:   { change: function(This) { var xdata = TP.get_icon_form_xdata(settingsWindow); panel.applyRotation(This.value, xdata); } }
                }, {
                    fieldLabel:   'Z-Index',
                    xtype:        'numberfield',
                    allowDecimals: false,
                    name:         'zindex',
                    minValue:      -10,
                    maxValue:      100,
                    step:            1,
                    value:         panel.xdata.layout.zindex != undefined ? panel.xdata.layout.zindex : 0,
                    listeners:   { change: function(This) { var xdata = TP.get_icon_form_xdata(settingsWindow); panel.applyZindex(This.value, xdata); } }
                }, {
                    fieldLabel:   'Scale',
                    id:           'layoutscale',
                    xtype:        'numberunit',
                    unit:         '%',
                    allowDecimals: true,
                    name:         'scale',
                    minValue:        0,
                    maxValue:    10000,
                    step:            1,
                    value:         panel.xdata.layout.scale != undefined ? panel.xdata.layout.scale : 100,
                    listeners:   { change: function(This) { var xdata = TP.get_icon_form_xdata(settingsWindow); panel.applyScale(This.value, xdata); } },
                    disabled:     (panel.hasScale || panel.xdata.appearance.type == 'icon') ? false : true,
                    hidden:        panel.iconType == 'text' ? true : false
                }, {
                    fieldLabel:   'Size',
                    id:           'layoutsize',
                    xtype:        'fieldcontainer',
                    layout:       'hbox',
                    defaults:      {
                        listeners:   { change: function(This) { var xdata = TP.get_icon_form_xdata(settingsWindow); panel.applyScale(This.value, xdata); } }
                    },
                    hidden:        panel.iconType == 'text' ? true : false,
                    items: [
                        { xtype: 'label', text:  'x:', style: 'margin-left: 0px; margin-right: 2px; margin-top: 2px;' },
                        {
                            xtype:        'numberunit',
                            unit:         'px',
                            allowDecimals: true,
                            name:         'size_x',
                            minValue:        0,
                            step:           10,
                            width:          70,
                            value:         panel.xdata.layout.size_x,
                            disabled:     (panel.hasScale || panel.xdata.appearance.type == 'icon') ? false : true
                        },
                        { xtype: 'label', text:  'y:', style: 'margin-left: 10px; margin-right: 2px; margin-top: 2px;' },
                        {
                            xtype:        'numberunit',
                            unit:         'px',
                            allowDecimals: true,
                            name:         'size_y',
                            minValue:        0,
                            step:           10,
                            width:          70,
                            value:         panel.xdata.layout.size_y,
                            disabled:     (panel.hasScale || panel.xdata.appearance.type == 'icon') ? false : true
                        },
                        { xtype: 'label', text: '(either use Scale or Size)', style: 'margin-left: 10px; margin-top: 4px;', cls: 'form-hint' }
                    ]
                }]
            }]
        }]
    };

    if(panel.xdata.appearance.type == 'shape') {
        TP.shapesStore.load();
    }
    var renderUpdateDo = function(forceColor, forceRenderItem) {
        if(TP.skipRender) { return; }
        var xdata = TP.get_icon_form_xdata(settingsWindow);
        if(panel.lastState != undefined) { xdata.state = panel.lastState; }
        if(panel.iconType == 'image') { panel.setRenderItem(xdata); }
        if(xdata.appearance      == undefined) { return; }
        if(xdata.appearance.type == undefined) { return; }
        if(xdata.appearance.type == 'shape') { forceRenderItem = true; }
        if(xdata.appearance.type != lastType || forceRenderItem) {
            if(panel.setRenderItem) { panel.setRenderItem(xdata, forceRenderItem, forceColor); }
            if(xdata.appearance.type == 'shape') {
                TP.shapesStore.load();
            }
        }
        lastType = xdata.appearance.type;

        if(panel.appearance.updateRenderAlways) { panel.appearance.updateRenderAlways(xdata, forceColor); }
        if(panel.appearance.updateRenderActive) { panel.appearance.updateRenderActive(xdata, forceColor); }

        labelUpdate();
        updateDisabledFields(xdata);
    };

    var appearanceItems = [{
        /* appearance type */
        xtype:      'combobox',
        fieldLabel: 'Type',
        name:       'type',
        id:         'appearance_types',
        editable:    false,
        valueField: 'value',
        displayField: 'name',
        store        : Ext.create('Ext.data.Store', {
            fields: ['value', 'name'],
            data:   TP.iconAppearanceTypes
        }),
        listConfig : {
            tpl : ((panel.iconType != 'host' && panel.iconType != 'service') ?
                    '<tpl for="."><div class="x-boundlist-item <tpl if="value == \'perfbar\'"> item-disabled</tpl>">'
                    +'{name}'
                    +'<tpl if="value == \'perfbar\'"><span style="margin-left:30px;">(Host/Service only)</span></tpl>'
                    +'</div></tpl>'
                   :
                    '<tpl for="."><div class="x-boundlist-item">{name}</div></tpl>')
        },
        listeners: {
            beforeselect: function(This, record, index, eOpts ) {
                if(panel.iconType != 'host' && panel.iconType != 'service') {
                    if(record.get('value') == 'perfbar') {
                        return(false);
                    }
                }
                return(true);
            },
            change: function(This, newValue, oldValue, eOpts) {
                Ext.getCmp('appearanceForm').items.each(function(f, i) {
                    if(f.cls != undefined) {
                        if(f.cls.match(newValue)) {
                            f.show();
                        } else {
                            f.hide();
                        }
                    }
                });
                if(newValue == 'icon' || panel.hasScale) {
                    Ext.getCmp('layoutscale').setDisabled(false);
                    Ext.getCmp('layoutsize').setDisabled(false);
                } else {
                    Ext.getCmp('layoutscale').setDisabled(true);
                    Ext.getCmp('layoutsize').setDisabled(true);
                }
                if(newValue == 'connector') {
                    Ext.getCmp('layoutFormPosition').setDisabled(true);
                } else {
                    Ext.getCmp('layoutFormPosition').setDisabled(false);
                }

                panel.appearance = Ext.create('tp.icon.appearance.'+newValue, { panel: panel });

                var originalRenderUpdate = TP.iconSettingsGlobals.renderUpdate;
                TP.iconSettingsGlobals.renderUpdate = Ext.emptyFn;
                if(panel.appearance.settingsWindowAppearanceTypeChanged) { panel.appearance.settingsWindowAppearanceTypeChanged(); }
                TP.iconSettingsGlobals.renderUpdate = originalRenderUpdate;
                TP.iconSettingsGlobals.renderUpdate();
            }
        }
    }];
    Ext.Array.each(TP.iconAppearanceTypes, function(t, i) {
        var cls = Ext.ClassManager.getByAlias('tp.icon.appearance.'+t.value);
        if(cls && cls.prototype.getAppearanceTabItems) {
            appearanceItems = appearanceItems.concat(cls.prototype.getAppearanceTabItems(panel));
        }
    });
    var appearanceTab = {
        title: 'Appearance',
        type:  'panel',
        hidden: panel.hideAppearanceTab,
        listeners: { show: TP.iconSettingsGlobals.perfDataUpdate },
        items: [{
            xtype : 'panel',
            layout: 'fit',
            border: 0,
            items: [{
                xtype:           'form',
                id:              'appearanceForm',
                bodyPadding:     2,
                border:          0,
                bodyStyle:       'overflow-y: auto;',
                submitEmptyText: false,
                defaults:      { anchor: '-12', labelWidth: 60, listeners: { change: function() { TP.iconSettingsGlobals.renderUpdate(); } } },
                items:           appearanceItems
            }]
        }]
    };

    /* Link Settings Tab */
    var server_actions_menu = [];
    Ext.Array.each(action_menu_actions, function(name, i) {
        server_actions_menu.push({
            text:    name,
            icon:    url_prefix+'plugins/panorama/images/cog.png',
            handler: function(This, eOpts) { This.up('form').getForm().setValues({link: 'server://'+name+'/'}) }
        });
    });
    var action_menus_menu = [];
    Ext.Array.each(action_menu_items, function(val, i) {
        var name = val.name;
        action_menus_menu.push({
            text:    name,
            icon:    url_prefix+'plugins/panorama/images/cog.png',
            handler: function(This, eOpts) { This.up('form').getForm().setValues({link: 'menu://'+name+'/'}) }
        });
    });
    var linkTab = {
        title: 'Link',
        type:  'panel',
        items: [{
            xtype : 'panel',
            layout: 'fit',
            border: 0,
            items: [{
                xtype:           'form',
                id:              'linkForm',
                bodyPadding:     2,
                border:          0,
                bodyStyle:       'overflow-y: auto;',
                submitEmptyText: false,
                defaults:      { anchor: '-12', labelWidth: 132 },
                items: [{
                    fieldLabel: 'Hyperlink',
                    xtype:      'textfield',
                    name:       'link',
                    emptyText:  'http://... or predefined from below'
                }, {
                    fieldLabel: 'Predefined Links',
                    xtype:      'fieldcontainer',
                    items:      [{
                        xtype:      'button',
                        text:       'Choose',
                        icon:       url_prefix+'plugins/panorama/images/world.png',
                        menu:       {
                            items: [{
                                text: 'My Dashboards',
                                icon: url_prefix+'plugins/panorama/images/user_suit.png',
                                menu: [{
                                    text:    'Loading...',
                                    icon:    url_prefix+'plugins/panorama/images/loading-icon.gif',
                                    disabled: true
                                }]
                            }, {
                                text: 'Public Dashboards',
                                icon: url_prefix+'plugins/panorama/images/world.png',
                                menu: [{
                                    text:    'Loading...',
                                    icon:    url_prefix+'plugins/panorama/images/loading-icon.gif',
                                    disabled: true
                                }]
                            }, {
                                text:    'Show Details',
                                icon:    url_prefix+'plugins/panorama/images/application_view_columns.png',
                                handler: function(This, eOpts) { This.up('form').getForm().setValues({link: 'dashboard://show_details'}) }
                            }, {
                                text:    'Refresh',
                                icon:    url_prefix+'plugins/panorama/images/arrow_refresh.png',
                                handler: function(This, eOpts) { This.up('form').getForm().setValues({link: 'dashboard://refresh'}) }
                            }, {
                                text: 'Server Actions',
                                icon: url_prefix+'plugins/panorama/images/lightning_go.png',
                                menu: server_actions_menu,
                                disabled: server_actions_menu.length > 0 ? false : true
                            }, {
                                text: 'Action Menus',
                                icon: url_prefix+'plugins/panorama/images/lightning_go.png',
                                menu: action_menus_menu,
                                disabled: action_menus_menu.length > 0 ? false : true
                            }],
                            listeners: {
                                afterrender: function(This, eOpts) {
                                    TP.load_dashboard_menu_items(This.items.get(0).menu, 'panorama.cgi?task=dashboard_list&list=my',     function(val) { This.up('form').getForm().setValues({link: 'dashboard://'+val.replace(/^pantab_/, '')})});
                                    TP.load_dashboard_menu_items(This.items.get(1).menu, 'panorama.cgi?task=dashboard_list&list=public', function(val) { This.up('form').getForm().setValues({link: 'dashboard://'+val.replace(/^pantab_/, '')})});
                                }
                            }
                        }
                    }]
                }, {
                    fieldLabel: 'New Tab',
                    xtype:      'checkbox',
                    name:       'newtab',
                    boxLabel:   '(opens links in new tab or window)'
                }]
            }]
        }]
    };

    /* Label Settings Tab */
    if(panel.xdata.label == undefined) { panel.xdata.label = {}; }
    var labelUpdate = Ext.emptyFn;
    var labelTab = {
        title: 'Label',
        type:  'panel',
        items: [{
            xtype : 'panel',
            layout: 'fit',
            border: 0,
            items: [{
                xtype:           'form',
                id:              'labelForm',
                bodyPadding:     2,
                border:          0,
                bodyStyle:       'overflow-y: auto;',
                submitEmptyText: false,
                defaults:      { anchor: '-12', labelWidth: 80, listeners: { change: function() { labelUpdate(); } } },
                items: [{
                    fieldLabel:   'Labeltext',
                    xtype:        'fieldcontainer',
                    layout:      { type: 'hbox', align: 'stretch' },
                    items: [{
                        xtype:        'textfield',
                        name:         'labeltext',
                        flex:          1,
                        id:           'label_textfield',
                        listeners:   { change: function() { labelUpdate(); } }
                    }, {
                        xtype:        'button',
                        icon:         url_prefix+'plugins/panorama/images/lightning_go.png',
                        margins:      {top: 0, right: 0, bottom: 0, left: 3},
                        tooltip:       'open label editor wizard',
                        handler:       function(btn) {
                            TP.openLabelEditorWindow(panel);
                        }
                    }]
                }, {
                    fieldLabel:   'Color',
                    xtype:        'colorcbo',
                    name:         'fontcolor',
                    value:        '#000000',
                    mouseover:     function(color) { var oldValue=this.getValue(); this.setValue(color); labelUpdate(); this.setRawValue(oldValue); },
                    mouseout:      function(color) { labelUpdate(); }
                }, {
                    xtype:        'fieldcontainer',
                    fieldLabel:   'Font',
                    layout:      { type: 'hbox', align: 'stretch' },
                    defaults:    { listeners: { change: function() { labelUpdate(); } } },
                    items:        [{
                        name:         'fontfamily',
                        xtype:        'fontcbo',
                        value:        '',
                        flex:          1,
                        editable:      false
                    }, {
                        xtype:        'numberunit',
                        allowDecimals: false,
                        name:         'fontsize',
                        width:         60,
                        unit:         'px',
                        margins:      {top: 0, right: 0, bottom: 0, left: 3},
                        value:         panel.xdata.label.fontsize != undefined ? panel.xdata.label.fontsize : 14
                    }, {
                        xtype:        'hiddenfield',
                        name:         'fontitalic',
                        value:         panel.xdata.label.fontitalic
                    }, {
                        xtype:        'button',
                        enableToggle:  true,
                        name:         'fontitalic',
                        icon:         url_prefix+'plugins/panorama/images/text_italic.png',
                        margins:      {top: 0, right: 0, bottom: 0, left: 3},
                        toggleHandler: function(btn, state) { this.up('form').getForm().setValues({fontitalic: state ? '1' : '' }); },
                        listeners: {
                            afterrender: function() { if(panel.xdata.label.fontitalic) { this.toggle(); } }
                        }
                    }, {
                        xtype:        'hiddenfield',
                        name:         'fontbold',
                        value:         panel.xdata.label.fontbold
                    }, {
                        xtype:        'button',
                        enableToggle:  true,
                        name:         'fontbold',
                        icon:         url_prefix+'plugins/panorama/images/text_bold.png',
                        margins:      {top: 0, right: 0, bottom: 0, left: 3},
                        toggleHandler: function(btn, state) { this.up('form').getForm().setValues({fontbold: state ? '1' : ''}); },
                        listeners: {
                            afterrender: function() { if(panel.xdata.label.fontbold) { this.toggle(); } }
                        }
                    }, {
                        xtype:        'hiddenfield',
                        name:         'fontcenter',
                        value:         panel.xdata.label.fontcenter
                    }, {
                        xtype:        'button',
                        enableToggle:  true,
                        name:         'fontcenter',
                        icon:         url_prefix+'plugins/panorama/images/text_align_center.png',
                        margins:      {top: 0, right: 0, bottom: 0, left: 3},
                        toggleHandler: function(btn, state) { this.up('form').getForm().setValues({fontcenter: state ? '1' : '' }); },
                        listeners: {
                            afterrender: function() { if(panel.xdata.label.fontcenter) { this.toggle(); } }
                        }
                    }]
                }, {
                    xtype:        'fieldcontainer',
                    fieldLabel:   'Position',
                    layout:      { type: 'hbox', align: 'stretch' },
                    defaults:    { listeners: { change: function() { labelUpdate(); } } },
                    items:        [{
                        name:         'position',
                        xtype:        'combobox',
                        store:        ['below', 'above', 'left', 'right', 'center', 'top-left'],
                        value:        'below',
                        flex:          1,
                        editable:      false
                    }, {
                        xtype:        'label',
                        text:         'Offset: x',
                        margins:      {top: 3, right: 2, bottom: 0, left: 7}
                    }, {
                        xtype:        'numberunit',
                        allowDecimals: false,
                        name:         'offsetx',
                        width:         60,
                        unit:         'px'
                    }, {
                        xtype:        'label',
                        text:         'y',
                        margins:      {top: 3, right: 2, bottom: 0, left: 7}
                    }, {
                        xtype:        'numberunit',
                        allowDecimals: false,
                        name:         'offsety',
                        width:         60,
                        unit:         'px'
                    }]
                }, {
                    fieldLabel:   'Orientation',
                    name:         'orientation',
                    xtype:        'combobox',
                    store:        ['horizontal', 'vertical'],
                    value:        'horizontal',
                    editable:      false
                }, {
                    fieldLabel:   'Background',
                    xtype:        'colorcbo',
                    name:         'bgcolor',
                    value:        '',
                    mouseover:     function(color) { var oldValue=this.getValue(); this.setValue(color); labelUpdate(); this.setRawValue(oldValue); },
                    mouseout:      function(color) { labelUpdate(); }
                }, {
                    xtype:        'fieldcontainer',
                    fieldLabel:   'Border',
                    layout:      { type: 'hbox', align: 'stretch' },
                    defaults:    { listeners: { change: function() { labelUpdate(); } } },
                    items:        [{
                        xtype:        'colorcbo',
                        name:         'bordercolor',
                        value:        '',
                        mouseover:     function(color) { var oldValue=this.getValue(); this.setValue(color); labelUpdate(); this.setRawValue(oldValue); },
                        mouseout:      function(color) { labelUpdate(); },
                        flex:          1,
                        margins:      {top: 0, right: 3, bottom: 0, left: 0}
                    }, {
                        xtype:        'numberunit',
                        allowDecimals: false,
                        name:         'bordersize',
                        width:         60,
                        unit:         'px'
                    }]
                }, {
                    fieldLabel: 'Backgr. Size',
                    xtype:      'fieldcontainer',
                    layout:     'table',
                    items: [{ xtype: 'label', text:  'width:', style: 'margin-left: 0; margin-right: 2px;' },
                            { xtype: 'numberfield', name:  'width', width: 53, value: panel.xdata.label.width, minValue: 0, listeners: {
                                change: function(This, newValue, oldValue, eOpts) {
                                    labelUpdate();
                                }
                            }},
                            { xtype: 'label', text:  'height:', style: 'margin-left: 10px; margin-right: 2px;' },
                            { xtype: 'numberfield', name:  'height', width: 53, value: panel.xdata.label.height, minValue: 0, listeners: {
                                change: function(This, newValue, oldValue, eOpts) {
                                    labelUpdate();
                                }
                            }},
                            { xtype: 'label', text:  'round corners:', style: 'margin-left: 10px; margin-right: 2px;' },
                            { xtype: 'numberfield', name:  'roundcorners', width: 50, value: panel.xdata.label.roundcorners, minValue: 0, listeners: {
                                change: function(This, newValue, oldValue, eOpts) {
                                    labelUpdate();
                                }
                            }}
                        ]
                    }, {
                    fieldLabel: 'Options',
                    xtype:      'fieldcontainer',
                    layout:     'table',
                    hidden:      panel.xdata.cls == 'TP.TextLabelWidget',
                    items: [{ xtype: 'label', text:  'display:', style: 'margin-left: 0; margin-right: 2px;' },
                            {
                                xtype:          'combobox',
                                name:           'display',
                                value:          'always',
                                store:         ['always', 'mouseover'],
                                editable:        false
                            }]
                    }
                ]
            }]
        }]
    };

    /* Popup Tab */
    var popupTab;
    if(panel.xdata.cls != 'TP.TextLabelWidget') {
        popupTab = {
            title: 'Popup',
            type:  'panel',
            items: [{
                xtype : 'panel',
                layout: 'fit',
                border: 0,
                bodyPadding: 2,
                items: [{
                    xtype:           'form',
                    id:              'popupForm',
                    bodyPadding:     2,
                    border:          0,
                    bodyStyle:       'overflow-y: auto;',
                    submitEmptyText: false,
                    defaults:      { anchor: '-12', labelWidth: 50 },
                    items: [{
                        xtype:        'fieldcontainer',
                        fieldLabel:   'Position',
                        layout:      { type: 'hbox', align: 'stretch' },
                        items:        [{
                            xtype:          'combobox',
                            name:           'popup_position',
                            value:          'automatic',
                            store:         ['automatic', 'absolute position', 'relative position'],
                            flex:            1,
                            editable:        false,
                            listeners:     {
                                change: function(This, newValue, oldValue, eOpts) {
                                    TP.getPanelDetailsHeader(panel, true);
                                    if(newValue == 'automatic') {
                                        Ext.getCmp('popup_x').setDisabled(true);
                                        Ext.getCmp('popup_y').setDisabled(true);
                                    }
                                    else {
                                        Ext.getCmp('popup_x').setDisabled(false);
                                        Ext.getCmp('popup_y').setDisabled(false);
                                    }
                                    TP.iconSettingsGlobals.popupPreviewUpdate();
                                }
                            }
                        }, {
                            xtype:        'label',
                            text:         'x',
                            margins:      {top: 3, right: 2, bottom: 0, left: 7}
                        }, {
                            xtype:        'numberunit',
                            allowDecimals: false,
                            id:           'popup_x',
                            name:         'popup_x',
                            width:         60,
                            unit:         'px',
                            disabled:      true,
                            listeners:   { change: function() { TP.iconSettingsGlobals.popupPreviewUpdate() } }
                        }, {
                            xtype:        'label',
                            text:         'y',
                            margins:      {top: 3, right: 2, bottom: 0, left: 7}
                        }, {
                            xtype:        'numberunit',
                            allowDecimals: false,
                            name:         'popup_y',
                            id:           'popup_y',
                            width:         60,
                            unit:         'px',
                            disabled:      true,
                            listeners:   { change: function() { TP.iconSettingsGlobals.popupPreviewUpdate() } }
                        }, {
                            xtype:        'label',
                            text:         'width',
                            margins:      {top: 3, right: 2, bottom: 0, left: 15}
                        }, {
                            xtype:        'numberunit',
                            allowDecimals: false,
                            name:         'popup_width',
                            id:           'popup_witdh',
                            width:         60,
                            unit:         'px',
                            listeners:   { change: function() { TP.iconSettingsGlobals.popupPreviewUpdate() }, keyup: function() { TP.iconSettingsGlobals.popupPreviewUpdate() } }
                        }]
                    }, {
                        xtype:        'fieldcontainer',
                        fieldLabel:   'Font',
                        layout:      { type: 'hbox', align: 'stretch' },
                        defaults:    { listeners: { change: function() { TP.iconSettingsGlobals.popupPreviewUpdate() } } },
                        items:        [{
                            name:         'popup_fontfamily',
                            xtype:        'fontcbo',
                            value:        '',
                            flex:          1,
                            editable:      false
                        }, {
                            xtype:        'numberunit',
                            allowDecimals: false,
                            name:         'popup_fontsize',
                            width:         60,
                            unit:         'px',
                            margins:      {top: 0, right: 0, bottom: 0, left: 3}
                        }]
                    }, {
                        fieldLabel:     'Popup',
                        xtype:          'combobox',
                        name:           'type',
                        value:          'default',
                        store:         ['default', 'off', 'custom'],
                        editable:        false,
                        listeners:     {
                            change: function(This, newValue, oldValue, eOpts) {
                                var defaults = TP.getPanelDetailsHeader(panel, true);
                                if(newValue == 'default') {
                                    Ext.getCmp('popup_textfield').setValue(defaults);
                                    Ext.getCmp('popup_textfield').setDisabled(true);
                                }
                                if(newValue == 'off') {
                                    Ext.getCmp('popup_textfield').setValue('');
                                    Ext.getCmp('popup_textfield').setDisabled(true);
                                }
                                if(newValue == 'custom') {
                                    var old = Ext.getCmp('popup_textfield').getValue();
                                    if(old == '' || old == defaults) {
                                        Ext.getCmp('popup_textfield')
                                            .setValue(defaults
                                                     +"\ncustom:\nadditional text with placeholders just\n"
                                                     +"like in labels. ex.: {{ name }}\n"
                                                     //+"read more in the <a href='https://thruk.org/documentation/dashboard.html#lable-editing' target='_blank'>thruk documentation<\/a>\n"
                                            );
                                    }
                                    Ext.getCmp('popup_textfield').setDisabled(false);
                                }
                            }
                        }
                      }, {
                        fieldLabel:     'Custom',
                        xtype:          'textarea',
                        name:           'content',
                        id:             'popup_textfield',
                        autoScroll:      true,
                        height:          170,
                        disabled:       (panel.xdata.popup && panel.xdata.popup.type == "custom") ? false : true,
                        fieldStyle:     { 'whiteSpace': 'pre' },
                        value:          TP.getPanelDetailsHeader(panel, true),
                        listeners:      { change: function() { TP.iconSettingsGlobals.popupPreviewUpdate() } }
                      }]
                }]
            }],
            listeners: {
                activate: function(This, eOpts) {
                    /* move to window center so the side panels fit onto the window */
                    TP.iconSettingsWindow.center();
                    var pos = TP.iconSettingsWindow.getPosition();
                    TP.iconSettingsWindow.setPosition(pos[0], 50);
                    TP.iconSettingsGlobals.popupPreviewUpdate();

                    if(TP.iconLabelHelpWindow == undefined) {
                        TP.iconLabelHelpWindow = new Ext.Window({
                            height:     550,
                            width:      450,
                            layout:    'fit',
                            autoScroll: true,
                            title:     'Help',
                            bodyStyle: 'background:white;',
                            items:      TP.iconLabelHelp(panel, 'popup_textfield', [{name: 'Popup Sections', items: TP.getPanelDetailsHeader(panel)}]),
                            listeners: { destroy: function() { delete TP.iconLabelHelpWindow; } },
                            alignToSettingsWindow: function() {
                                var pos  = TP.iconSettingsWindow.getPosition();
                                this.showAt([pos[0] - 460, pos[1]]);
                            }
                        }).show();
                        TP.iconLabelHelpWindow.alignToSettingsWindow();
                    }
                },
                deactivate: function(This, eOpts) {
                    if(TP.iconTip) { TP.iconTip.hide(); }
                    if(TP.iconLabelHelpWindow) { TP.iconLabelHelpWindow.destroy(); }
                }
            }
        };
    }

    /* permissions Tab */
    var access = [];
    if(panel.xdata.groups == undefined) { panel.xdata.groups = []; }
    Ext.Array.each(panel.xdata.groups, function(item, idx, len) {
        var group = Ext.Object.getKeys(item)[0];
        var perm  = item[group];
        access.push({ contactgroup: group, permission: perm });
    });
    var permissionsStore = Ext.create('Ext.data.Store', {
        fields: ['contactgroup', 'permission'],
        data: access
    });
    var permissionsItems = [,{
            xtype: 'label',
            text:  'Hide/show this icon for specific contactgroups',
            style: "margin-left: 26%;"
        },{
            xtype:      'gridpanel',
            name:       'permissions',
            id:         'permissionsGrid',
            columns:    [
                    { header: 'Group', flex: 1, dataIndex: 'contactgroup',  align: 'left', tdCls: 'editable', editor: {
                            xtype:            'searchCbo',
                            panel:             panel,
                            storeExtraParams: { wildcards: 1 },
                            lazyRender:        true,
                            allowBlank:        false
                        }
                    },
                    { header: 'Permission', width: 140,  dataIndex: 'permission', align: 'left', tdCls: 'editable', editor: {
                            xtype:         'combobox',
                            triggerAction: 'all',
                            selectOnTab:    true,
                            lazyRender:     true,
                            editable:       false,
                            store:        ['show', 'hide']
                        }
                    },
                    { header: '',  width: 30,
                      xtype: 'actioncolumn',
                      items: [{
                            icon: '../plugins/panorama/images/delete.png',
                            handler: TP.removeGridRow,
                            action: 'remove'
                      }],
                      tdCls: 'clickable icon_column'
                    }
            ],
            store: permissionsStore,
            selType:    'rowmodel',
            viewConfig: {
                plugins: {
                    ptype: 'gridviewdragdrop',
                    dragText: 'Drag and drop to reorganize'
                }
            },
            plugins:     [Ext.create('Ext.grid.plugin.RowEditing', {
                clicksToEdit: 1
            })],
            height: 230,
            width:  300,
            fbar: [{
                type: 'button',
                text: 'Add Contactgroup',
                iconCls: 'user-tab',
                handler: function(btn, eOpts) {
                    var store = btn.up('gridpanel').store;
                    store.add({contactgroup:'*', permission:'hide'})
                    btn.up('gridpanel').plugins[0].startEdit(store.last(), 0);
                }
            }]
        },{
            xtype: 'label',
            text:  'Hint: order from top to bottom, first match wins',
            cls:   'form-hint',
            style: "margin-left: 30%;"
        }
    ];
    var permissionsTab = {
        title : 'Permissions',
        type  : 'panel',
        items: [{
            xtype : 'panel',
            layout: 'fit',
            border: 0,
            items: [{
                    xtype:          'form',
                    id:             'permissionForm',
                    bodyPadding:     2,
                    border:          0,
                    bodyStyle:      'overflow-y: auto;',
                    submitEmptyText: false,
                    defaults:      { anchor: '-12', labelWidth: 130 },
                    items:           permissionsItems
            }]
        }]
    };

    /* Source Tab */
    var sourceTab = {
        title: 'Source',
        type:  'panel',
        listeners: {
            activate: function(This) {
                var xdata = TP.get_icon_form_xdata(settingsWindow);
                var j     = Ext.JSON.encode(xdata);
                try {
                    j = JSON.stringify(xdata, null, 2);
                } catch(err) {
                    TP.logError(panel.id, "jsonStringifyException", err);
                }
                this.down('form').getForm().setValues({source: j, sourceError: ''});
            }
        },
        items: [{
            xtype : 'panel',
            layout: 'fit',
            border: 0,
            items: [{
                xtype:           'form',
                id:              'sourceForm',
                bodyPadding:     2,
                border:          0,
                bodyStyle:       'overflow-y: auto;',
                submitEmptyText: false,
                defaults:      { anchor: '-12', labelWidth: 50 },
                items: [{
                    fieldLabel:     'Source',
                    xtype:          'textarea',
                    name:           'source',
                    height:         190
                }, {
                    fieldLabel:     ' ',
                    labelSeparator: '',
                    xtype:          'fieldcontainer',
                    items: [{
                        xtype:      'button',
                        name:       'sourceapply',
                        text:       'Apply',
                        width:       100,
                        handler: function(btn) {
                            var values = Ext.getCmp('sourceForm').getForm().getValues();
                            try {
                                var xdata = Ext.JSON.decode(values.source);
                                TP.setIconSettingsValues(xdata);
                            } catch(err) {
                                TP.logError(panel.id, "jsonDecodeException", err);
                                Ext.getCmp('sourceForm').getForm().setValues({sourceError: err});
                            }
                        }
                    }]
                }, {
                    fieldLabel:     ' ',
                    labelSeparator: '',
                    xtype:          'displayfield',
                    name:           'sourceError',
                    value:          ''
                }]
            }]
        }]
    };

    var tabPanel = new Ext.TabPanel({
        activeTab         : panel.initialSettingsTab ? panel.initialSettingsTab : 0,
        enableTabScroll   : true,
        items             : [
            generalTab,
            layoutTab,
            appearanceTab,
            linkTab,
            labelTab,
            popupTab,
            permissionsTab,
            sourceTab
        ]
    });

    /* add current available backends */
    var backendItem = TP.getFormField(Ext.getCmp("generalForm"), 'backends');
    if(backendItem) {
        TP.updateArrayStoreKV(backendItem.store, TP.getAvailableBackendsTab(tab));
        if(backendItem.store.count() <= 1) { backendItem.hide(); }
    }

    var settingsWindow = new Ext.Window({
        height:  350,
        width:   600,
        layout: 'fit',
        hidden:  true,
        items:   tabPanel,
        panel:   panel,
        title:  'Icon Settings',
        buttonAlign: 'center',
        fbar: [/* panlet setting cancel button */
               { xtype:  'button',
                 text:   'cancel',
                 handler: function(This) {
                    settingsWindow.destroy();
                 }
               },
               /* panlet setting save button */
               { xtype:  'button',
                 text:   'save',
                 handler: function() {
                    settingsWindow.skipRestore = true;
                    panel.stateful = true;
                    delete panel.xdata.label;
                    delete panel.xdata.link;
                    delete panel.xdata.popup;
                    delete panel.xdata.groups;
                    var xdata = TP.get_icon_form_xdata(settingsWindow);
                    TP.log('['+this.id+'] icon config updated: '+Ext.JSON.encode(xdata));
                    for(var key in xdata) { panel.xdata[key] = xdata[key]; }
                    panel.applyState({xdata: panel.xdata});
                    if(panel.classChanged) {
                        panel.xdata.cls = panel.classChanged;
                    }
                    delete TP.iconSettingsWindow;
                    panel.forceSaveState();
                    settingsWindow.destroy();
                    panel.firstRun = false;
                    panel.applyXdata();
                    var tab = panel.tab;
                    TP.updateAllIcons(tab, panel.id);
                    TP.updateAllLabelAvailability(tab, panel.id);
                 }
               }
        ],
        listeners: {
            afterRender: function (This) {
                var form = Ext.getCmp('layoutForm').getForm();
                this.nav = Ext.create('Ext.util.KeyNav', this.el, {
                    'left':  function(evt){ form.setValues({x: Number(form.getValues().x)-1}); },
                    'right': function(evt){ form.setValues({x: Number(form.getValues().x)+1}); },
                    'up':    function(evt){ form.setValues({y: Number(form.getValues().y)-1}); },
                    'down':  function(evt){ form.setValues({y: Number(form.getValues().y)+1}); },
                    ignoreInputFields: true,
                    scope: panel
                });
                TP.setIconSettingsValues(panel.xdata);
            },
            destroy: function() {
                delete TP.iconSettingsWindow;
                panel.stateful = true;

                if(TP.iconTip) { TP.iconTip.hide(); }
                if(TP.iconLabelHelpWindow) { TP.iconLabelHelpWindow.destroy(); }
                if(!settingsWindow.skipRestore) {
                    // if we cancel directly after adding a new icon, destroy it
                    tab.enableMapControlsTemp();
                    if(panel.firstRun) {
                        panel.destroy();
                    } else {
                        if(panel.classChanged || panel.xdata.appearance.type == "connector") {
                            panel.redraw();
                            return;
                        } else {
                            // restore position and layout
                            if(panel.setRenderItem) { panel.setRenderItem(undefined, true); }
                            if(TP.cp.state[panel.id])  { panel.applyXdata(TP.cp.state[panel.id].xdata); }
                        }
                    }
                }
                if(panel.el) {
                    panel.el.dom.style.outline = "";
                    panel.setIconLabel();
                }
                if(panel.dragEl1 && panel.dragEl1.el) { panel.dragEl1.el.dom.style.outline = ""; }
                if(panel.dragEl2 && panel.dragEl2.el) { panel.dragEl2.el.dom.style.outline = ""; }
                if(panel.labelEl && panel.labelEl.el) { panel.labelEl.el.dom.style.outline = ""; }
                TP.updateAllIcons(panel.tab); // workaround to put labels in front

                if(panel.labelEl && panel.xdata.label.display && panel.xdata.label.display == 'mouseover') { panel.labelEl.hide(); }
            },
            move: function() {
                if(TP.iconTip) { TP.iconTip.alignToSettingsWindow(); }
                if(TP.iconLabelHelpWindow) { TP.iconLabelHelpWindow.alignToSettingsWindow(); }
            }
        }
    }).show();
    Ext.getBody().unmask();
    settingsWindow.permissionsStore = permissionsStore;

    TP.setIconSettingsValues(panel.xdata);
    TP.iconSettingsWindow = settingsWindow;

    labelUpdate = function() {
        var xdata = TP.get_icon_form_xdata(settingsWindow);
        panel.setIconLabel(xdata.label || {});
    };
    TP.iconSettingsGlobals.stateUpdate = function() {
        var xdata = TP.get_icon_form_xdata(settingsWindow);
        TP.updateAllIcons(panel.tab, panel.id, xdata, undefined, function() {
            if(!TP.iconSettingsWindow) { return; } // closed meanwhile
            panel.refreshHandler(panel.lastState); // recalculate state
            TP.iconSettingsGlobals.renderUpdate();
            labelUpdate();
            // update performance data stores
            TP.iconSettingsGlobals.perfDataUpdate();
        });
    };

    TP.iconSettingsGlobals.popupPreviewUpdate = function() {
        window.clearTimeout(TP.timeouts['timeout_popup_preview']);
        TP.timeouts['timeout_popup_preview'] = window.setTimeout(function() {
            TP.suppressIconTip = false;
            panel.locked = true;
            TP.iconTipTarget = panel;

            var xdata = TP.get_icon_form_xdata(settingsWindow);
            var prevX = panel.xdata.popup;
            panel.xdata.popup = xdata.popup;

            TP.tipRenderer({ target: panel, stopEvent: function() {} }, panel, undefined, true);

            TP.iconTip.forceHide();
            TP.iconTip.show();
            window.clearTimeout(TP.iconTip.hideTimer);
            delete TP.iconTip.hideTimer;

            panel.locked = false;
            TP.suppressIconTip = true;

            TP.iconTip.alignToSettingsWindow();
            panel.xdata.popup = prevX;
        }, 100);
    };

    // new mouseover tips while settings are open
    TP.iconTip.hide();

    // move settings window next to panel itself
    var showAtPos = TP.getNextToPanelPos(panel, settingsWindow.width, settingsWindow.height);
    panel.setIconLabel();
    settingsWindow.showAt(showAtPos);
    TP.iconSettingsWindow.panel = panel;

    settingsWindow.renderUpdateDo = renderUpdateDo;
    TP.iconSettingsGlobals.renderUpdate = function(forceColor, forceRenderItem, delay) {
        if(delay == undefined) { delay = 100; }
        if(delay == 0) {
            TP.iconSettingsWindow.renderUpdateDo(forceColor, forceRenderItem);
            return;
        }
        if(TP.skipRender) { return; }
        TP.reduceDelayEvents(TP.iconSettingsWindow, function() {
            if(TP.skipRender)          { return; }
            if(!TP.iconSettingsWindow) { return; }
            TP.iconSettingsWindow.renderUpdateDo(forceColor, forceRenderItem);
        }, delay, 'timeout_settings_render_update');
    };
    TP.iconSettingsGlobals.renderUpdate();

    /* highlight current icon */
    if(panel.xdata.appearance.type == "connector") {
        panel.dragEl1.el.dom.style.outline = "2px dotted orange";
        panel.dragEl2.el.dom.style.outline = "2px dotted orange";
    } else if (panel.iconType == "text") {
        if(panel.labelEl && panel.labelEl.el) {
            panel.labelEl.el.dom.style.outline = "2px dotted orange";
        }
    } else {
        panel.el.dom.style.outline = "2px dotted orange";
    }
};

TP.get_icon_form_xdata = function(settingsWindow) {
    var xdata = {
        general:    Ext.getCmp('generalForm').getForm().getValues(),
        layout:     Ext.getCmp('layoutForm').getForm().getValues(),
        appearance: Ext.getCmp('appearanceForm').getForm().getValues(),
        link:       Ext.getCmp('linkForm').getForm().getValues(),
        label:      Ext.getCmp('labelForm').getForm().getValues(),
        popup:      Ext.getCmp('popupForm') && Ext.getCmp('popupForm').getForm().getValues()
    };
    xdata.groups = [];
    TP.iconSettingsWindow.permissionsStore.each(function(rec) {
        var row = {};
        row[rec.data.contactgroup] = rec.data.permission;
        xdata.groups.push(row);
    });
    if(xdata.groups.length == 0) { delete xdata.groups; }

    // clean up
    if(xdata.label.labeltext == '')   { delete xdata.label; }
    if(xdata.link.link == '')         { delete xdata.link;  }
    if(xdata.popup && xdata.popup.type == 'default' && xdata.popup.popup_position == 'automatic' && xdata.popup.popup_fontfamily == '' && xdata.popup.popup_fontsize == 14 && xdata.popup.popup_width == 500) { delete xdata.popup; }
    if(xdata.layout.rotation == 0)  { delete xdata.layout.rotation; }
    Ext.getCmp('appearance_types').store.each(function(data, i) {
        var t = data.data.value;
        var t2 = t;
        if(t == 'speedometer') { t2 = 'speedo'; }
        var p = new RegExp('^'+t2, 'g');
        for(var key in xdata.appearance) {
            if(key.match(p) && t != xdata.appearance.type) {
                delete xdata.appearance[key];
            }
        }
    });
    if(xdata.appearance.type == "connector") {
        xdata.layout.lon1 = xdata.appearance.lon1;
        xdata.layout.lat1 = xdata.appearance.lat1;
        xdata.layout.lon2 = xdata.appearance.lon2;
        xdata.layout.lat2 = xdata.appearance.lat2;
    }
    delete xdata.appearance.lon1;
    delete xdata.appearance.lat1;
    delete xdata.appearance.lon2;
    delete xdata.appearance.lat2;

    if(settingsWindow.panel.hideAppearanceTab)  { delete xdata.appearance; }
    if(settingsWindow.panel.iconType == 'text') { delete xdata.general;    }
    if(xdata.appearance) {
        delete xdata.appearance.speedoshadow;
        delete xdata.appearance.pieshadow;
    }
    if(xdata.general) {
        delete xdata.general.newcls;
        if(xdata.general.backends && xdata.general.backends.length == 1 && xdata.general.backends[0] == '') {
            delete xdata.general.backends;
        }
    }
    return(xdata);
}

TP.openLabelEditorWindow = function(panel) {
    var oldValue  = Ext.getCmp('label_textfield').getValue();
    new Ext.Window({
        height:  500,
        width:   650,
        title:  'Label Editor',
        modal:  true,
        buttonAlign: 'center',
        fbar: [/* panlet setting cancel button */
               { xtype:  'button',
                 text:   'cancel',
                 handler: function(This) {
                    var labelEditorWindow = This.up('window');
                    Ext.getCmp('label_textfield').setValue(oldValue);
                    labelEditorWindow.destroy();
                 }
               },
               /* panlet setting save button */
               { xtype:  'button',
                 text:   'save',
                 handler: function(This) {
                    var labelEditorWindow = This.up('window');
                    Ext.getCmp('label_textfield').setValue(labelEditorWindow.down('textarea').getValue())
                    labelEditorWindow.destroy();
                 }
               }
        ],
        items:   [{
            xtype: 'panel',
            height: 120,
            border: 0,
            items: [{
                    xtype:           'form',
                    bodyPadding:     2,
                    border:          0,
                    submitEmptyText: false,
                    layout:          'anchor',
                    defaults:      { width: '99%', labelWidth: 40 },
                    items:        [{
                        xtype:      'textarea',
                        value:       Ext.getCmp('label_textfield').getValue().replace(/<br>/g,"<br>\n"),
                        id:         'label_textfield_edit',
                        height:      115,
                        listeners: {
                            change: function(This) {
                                Ext.getCmp('label_textfield').setValue(This.getValue())
                            }
                        }
                    }]
                }
            ]
        }, {
            xtype: 'panel',
            layout: 'fit',
            height: 320,
            border: 0,
            items: [{
                    xtype:           'form',
                    bodyPadding:     2,
                    border:          0,
                    bodyStyle:       'overflow-y: auto;',
                    submitEmptyText: false,
                    layout:          'anchor',
                    defaults:      { width: '99%', labelWidth: 40 },
                    items:        [TP.iconLabelHelp(panel, 'label_textfield_edit')]
                }
            ]
        }]
    }).show();
    Ext.getCmp('label_textfield').setValue(" ");
    Ext.getCmp('label_textfield').setValue(Ext.getCmp('label_textfield_edit').getValue());
}

TP.iconLabelHelp = function(panel, textarea_id, extra) {
    var perf_data = '';
    // ensure fresh and correct performance data
    var macros = TP.getPanelMacros(panel);
    for(var key in macros.perfdata) {
        delete macros.perfdata[key].perf;
        delete macros.perfdata[key].key;
        for(var key2 in macros.perfdata[key]) {
            var keyname = '.'+key;
            if(key.match(/[^a-zA-Z]/)) { keyname = '[\''+key+'\']'; }
            perf_data += '<tr><td><\/td><td><i>perfdata'+keyname+'.'+key2+'<\/i><\/td><td>'+macros.perfdata[key][key2]+'<\/td><\/tr>'
        }
    }

    var trend_data = '';
    if(macros.trend && macros.trend.against) {
        trend_data += '<tr><th>Trend Icon Data:<\/th><td colspan=2><\/td><\/tr>'
        trend_data += '<tr><td><\/td><td><i>trend.compare<\/i><\/td><td>'+macros.trend.compare+'<\/td><\/tr>'
        trend_data += '<tr><td><\/td><td><i>trend.against<\/i><\/td><td>'+macros.trend.against+'<\/td><\/tr>'
        trend_data += '<tr><td><\/td><td><i>trend.result<\/i><\/td><td>'+macros.trend.result+'<\/td><\/tr>'
    }

    var extra_items = "";
    if(extra) {
        for(var x=0; x<extra.length; x++) {
            extra_items += '<tr><th>'+extra[x].name+':<\/th><td colspan=2><\/td><\/tr>';
            var data = extra[x].items;
            for(var y=0; y<data.length; y++) {
                extra_items += '<tr><td><\/td><td><i>{{ '+data[y]+' }}<\/i><\/td><td><\/td><\/tr>';
            }
        }
    }
    var help = {
            xtype:   'label',
            cls:     'labelhelp',
            html:    '<p>Use HTML to format your label<br>'
                    +'Ex.: <i>Host &lt;b&gt;{{name}}&lt;/b&gt;<\/i>, Newlines: <i>&lt;br&gt;<\/i><\/p>'
                    +'<p>It is possible to create dynamic labels with {{placeholders}}.<br>'
                    +'Ex.: <i>Host {{name}}: {{plugin_output}}<\/i><\/p>'
                    +'<p>You may also do calculations inside placeholders like this:<br>'
                    +'Ex.: <i>Group XY {{totals.ok}}/{{totals.ok + totals.critical + totals.warning + totals.unknown}}<\/i><\/p>'
                    +'<p>use sprintf to format numbers:<br>'
                    +'Ex.: <i>{{sprintf("%.2f %s",perfdata.rta.val, perfdata.rta.unit)}}<\/i><\/p>'
                    +'<p>use strftime to format timestamps:<br>'
                    +'Ex.: <i>{{strftime("%Y-%m-%d",last_check)}}<\/i><\/p>'
                    +'<p>conditionals are possible:<br>'
                    +'Ex.: <i>{{ if(acknowledged) {...} else {...} }}<\/i><\/p>'

                    +'<p>There are different variables available depending on the type of icon/widget:<br>'
                    +'<table><tr><th>Groups/Filters:<\/th><td><i>name<\/i><\/td><td>Groupname<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>alias<\/i><\/td><td>Group alias<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>totals.services.ok<\/i><\/td><td>total number of ok services<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>totals.services.warning<\/i><\/td><td>total number of warning services<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>totals.services.critical<\/i><\/td><td>total number of critical services<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>totals.services.unknown<\/i><\/td><td>total number of unknown services<\/td><\/tr>'

                    +'<tr><td><\/td><td><i>totals.hosts.up<\/i><\/td><td>total number of up hosts<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>totals.hosts.down<\/i><\/td><td>total number of down hosts<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>totals.hosts.unreachable<\/i><\/td><td>total number of unreachable hosts<\/td><\/tr>'

                    +'<tr><th>Hosts:<\/th><td><i>name<\/i><\/td><td>Hostname<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>alias<\/i><\/td><td>Host alias<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>state<\/i><\/td><td>State: 0 - Ok, 1 - Warning, 2 - Critical,...<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>performance_data<\/i><\/td><td>Performance data. Use list below to access specific values<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>has_been_checked<\/i><\/td><td>Has this host been checked: 0 - No, 1 - Yes<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>scheduled_downtime_depth<\/i><\/td><td>Downtime: 0 - No, &gtl;=1 - Yes<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>acknowledged<\/i><\/td><td>Has this host been acknowledged: 0 - No, 1 - Yes<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>last_check<\/i><\/td><td>Timestamp of last check<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>last_state_change<\/i><\/td><td>Timestamp of last state change<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>last_notification<\/i><\/td><td>Timestamp of last notification<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>plugin_output<\/i><\/td><td>Plugin Output<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>long_plugin_output<\/i><\/td><td>Plugin Output<\/td><\/tr>'

                    +'<tr><th>Services:<\/th><td><i>host_name<\/i><\/td><td>Hostname<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>description<\/i><\/td><td>Servicename<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2>(other attributes are identical to hosts)<\/td><\/tr>'

                    +trend_data

                    +'<tr><th>Performance Data:<\/th><td colspan=2>(available performance data with their current values)<\/td><\/tr>'
                    +perf_data

                    +'<tr><th>Availability Data:<\/th><td colspan=2><\/td><\/tr>'
                    +'<tr><td><\/td><td><i>{{ sprintf("%.2f", availability({d: "60m"})) }}%<\/i><\/td><td>availability for the last 60 minutes<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>{{ sprintf("%.2f", availability({d: "24h"})) }}%<\/i><\/td><td>availability for the last 24 hours<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>{{ sprintf("%.2f", availability({d: "7d"})) }}%<\/i><\/td><td>availability for the last 7 days<\/td><\/tr>'
                    +'<tr><td><\/td><td><i>{{ sprintf("%.2f", availability({d: "31d"})) }}%<\/i><\/td><td>availability for the last 31 days<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2><i>{{ sprintf("%.2f", availability({d: "24h", tm: "5x8"})) }}%<\/i><\/td><\/tr>'
                    +'<tr><td><\/td><td><\/td><td>availability for the last 24 hours within given timeperiod<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2><i>{{ sprintf("%.2f", availability({d: "24h", s: "cu"})) }}%<\/i><\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2>service availablility with only critical and unknown assumed as unavailable<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2>avail. options are: d: &lt;duration&gt;, tm: &lt;timeperiod&gt;, s: &lt;servicesstates&gt;, h: &lt;hoststates&gt;, downtime: false<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2>host states are d (down), u (unreachable)<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2>service states are w (warning), c (critical) and u (unknown)<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2>downtimes are assumed to be available unless downtime: false is set<\/td><\/tr>'
                    +'<tr><td><\/td><td colspan=2><i>{{ sprintf("%.2f", availability({d: "24h", tm: "5x8", s: "cu", downtime: false})) }}%<\/i><\/td><\/tr>'
                    +extra_items

                    +'<\/table>',
                listeners: {
                    afterrender: function(This) {
                        var examples = This.el.dom.getElementsByTagName('i');
                        Ext.Array.each(examples, function(el, i) {
                            el.className = "clickable";
                            el.onclick   = function(i) {
                                var cur = Ext.getCmp(textarea_id).getValue();
                                var val = Ext.htmlDecode(el.innerHTML);
                                if(val == "long_plugin_output") { val = "{{ nl2br(long_plugin_output) }}"; }
                                if(!val.match(/\{\{.*?\}\}/) && (val.match(/^perfdata\./) || val.match(/^perfdata\[/) || val.match(/^totals\./) || val.match(/^trend\./) || val.match(/^avail\./) || val.match(/^[a-z_]+$/))) { val = '{{'+val+'}}'; }
                                if(val.match(/<br>/)) { val += "\n"; }
                                var pos = getCaret(Ext.get(textarea_id+'-inputEl').dom);
                                var txt = cur.substr(0, pos) + val + cur.substr(pos);
                                Ext.getCmp(textarea_id).setValue(txt);
                                Ext.getCmp(textarea_id).up('form').body.dom.scrollTop=0;
                                Ext.getCmp(textarea_id).focus();
                                setCaretToPos(Ext.get(textarea_id+'-inputEl').dom, pos+val.length);
                            }
                        });
                    }
                }
    };
    return(help);
}


TP.setIconSettingsValues = function(xdata) {
    xdata = TP.clone(xdata);
    // set some defaults
    if(!xdata.label)            { xdata.label = { labeltext: '' }; }
    if(!xdata.label.fontsize)   { xdata.label.fontsize   = 14; }
    if(!xdata.label.bordersize) { xdata.label.bordersize =  1; }
    if(!xdata.popup)            { xdata.popup = { type: 'default' }; }
    Ext.getCmp('generalForm').getForm().setValues(xdata.general);
    Ext.getCmp('layoutForm').getForm().setValues(xdata.layout);
    Ext.getCmp('appearanceForm').getForm().setValues(xdata.appearance);
    Ext.getCmp('linkForm').getForm().setValues(xdata.link);
    Ext.getCmp('labelForm').getForm().setValues(xdata.label);
    Ext.getCmp('popupForm') && Ext.getCmp('popupForm').getForm().setValues(xdata.popup);
}

TP.getNextToPanelPos = function(panel, width, height) {
    if(!panel || !panel.el) { return([0,0]); }
    var sizes = [];
    sizes.push(panel.getSize().width);
    if(panel.labelEl) {
        sizes.push(panel.labelEl.getSize().width);
    }
    sizes.push(180); // max size of new speedos
    var offsetLeft  = 30;
    var offsetRight = Ext.Array.max(sizes) + 10;
    var offsetY = 40;
    var panelPos     = panel.getPosition();
    var viewPortSize = TP.viewport.getSize();
    if(viewPortSize.width > panelPos[0] + width+offsetRight) {
        panelPos[0] = panelPos[0] + offsetRight;
    } else {
        panelPos[0] = panelPos[0] - width - offsetLeft;
    }
    if(panelPos[1] - 50 < 0) {
        panelPos[1] = offsetY;
    }
    else if(viewPortSize.height > panelPos[1] + height - offsetY) {
        panelPos[1] = panelPos[1] - offsetY;
    } else {
        panelPos[1] = viewPortSize.height - height - offsetY;
    }
    // make sure its on the screen
    if(panelPos[0] <  0) { panelPos[0] =  0; }
    if(panelPos[1] < 20) { panelPos[1] = 20; }
    return(panelPos);
}

TP.getPanelDetailsHeader = function(panel, asText) {
    var d = panel.getDetails();
    var header = [];
    for(var x=0; x<d.length; x++) {
        header.push(d[x][0]);
    }
    if(asText) {
        var txt = '';
        if(header.length > 0) {
            txt = '{{ ' + header.join(' }}\n{{ ')+' }}';
        }
        return(txt);
    }
    return(header);
}
