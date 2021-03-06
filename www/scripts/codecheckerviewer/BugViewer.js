define([
  'dojo/_base/declare',
  'dojo/dom-class',
  'dojo/dom-construct',
  'dojo/dom-style',
  'dojo/fx',
  'dojo/fx/Toggler',
  'dojo/keys',
  'dojo/on',
  'dojo/query',
  'dojo/store/Memory',
  'dojo/store/Observable',
  'dojo/topic',
  'dojox/html/entities',
  'dijit/Dialog',
  'dijit/tree/ObjectStoreModel',
  'dijit/layout/ContentPane',
  'dijit/layout/BorderContainer',
  'dijit/form/Button',
  'dijit/form/CheckBox',
  'dijit/form/Select',
  'dijit/form/SimpleTextarea',
  'dijit/Tooltip',
  'codechecker/CommentView',
  'codechecker/HtmlTree',
  'codechecker/util',
  'codechecker/hashHelper'],
function (declare, domClass, dom, style, fx, Toggler, keys, on, query, Memory,
  Observable, topic, entities, Dialog, ObjectStoreModel, ContentPane,
  BorderContainer, Button, CheckBox, Select, SimpleTextarea, Tooltip,
  CommentView, HtmlTree, util, hashHelper) {

  function resetJsPlumb(editor) {
    if (editor.jsPlumbInstance)
      editor.jsPlumbInstance.reset();

    // The position of this DOM element is set to relative so jsPlumb lines work
    // properly in the text view.
    var jsPlumbParentElement
      = query('.CodeMirror-lines', editor.codeMirror.getWrapperElement())[0];
    style.set(jsPlumbParentElement, 'position', 'relative');

    editor.jsPlumbInstance = jsPlumb.getInstance({
      Container : jsPlumbParentElement,
      Anchor : ['Perimeter', { shape : 'Ellipse' }],
      Endpoint : ['Dot', { radius : 1 }],
      PaintStyle : { strokeStyle : '#a94442', lineWidth : 2 },
      ConnectionsDetachable : false,
      ConnectionOverlays : [['Arrow',
        { location : 1, length : 10, width : 8 }]]
    });
  }

  function getFullHeight(element) {
    var computedStyle = style.getComputedStyle(element);

    var height = parseInt(computedStyle.height);
    var paddingTop = parseInt(computedStyle.paddingTop);
    var paddingBottom = parseInt(computedStyle.paddingBottom);
    var borderTop = parseInt(computedStyle.borderTopWidth);
    var borderBottom = parseInt(computedStyle.borderBottomWidth);
    var marginTop = parseInt(computedStyle.marginTop);
    var marginBottom = parseInt(computedStyle.marginBottom);

    return height + paddingTop + paddingBottom + borderTop + borderBottom +
      marginTop + marginBottom;
  }

  /**
   * The report information come from the ListOfBugs table in which the file
   * paths are formatted: /file/path.xyz @ Line 123. This function cuts the path
   * part of this string.
   */
  function getProperFilePath(filepath) {
    var endPos = filepath.indexOf(' ');
    if (endPos === -1)
      endPos = filepath.length;

    return filepath.substr(0, endPos);
  }

  /**
   * Creates a bug step enumeration icon.
   * @param value {integer} - Content of the enumeration icon.
   * @param type {error|fixit|info} - Class type of the enumeration icon.
   */
  function createBugStepEnumeration(value, type) {
    return dom.create('span', {
      class : 'checker-enum ' + type,
      innerHTML : value
    });
  }

  /**
   * Parsing the bug step message and replace the `(fixit)` string with an icon.
   */
  function parseBugStepMsg(message) {
    var ret = message;

    if (message.indexOf('(fixit)') > -1)
      ret = '<span class="tag fixit">fixit</span>'
        + message.replace(' (fixit)', '');

    return ret;
  }

  var Editor = declare(ContentPane, {
    constructor : function () {
      this._lineWidgets = [];
      this._lineMarks = [];

      this.style = 'padding: 0;';
    },

    postCreate : function () {
      var that = this;

      this.header = dom.create('div', { class : 'editorHeader' }, this.domNode);
      this.filepath = dom.create('div', {
        class : 'filepath compact'
      }, this.header);

      this.sameReportSelectorWrapper = dom.create('div', {
        class : 'same-report-selector-wrapper'
      }, this.header);

      this.sameReportSelectorLabel = dom.create('span', {
        class : 'same-report-selector-label',
        innerHTML : 'Also found in:'
      }, this.sameReportSelectorWrapper);

      var sameReportSelector =
        dom.create('div', null, this.sameReportSelectorWrapper);

      this._sameReportSelector = new Select({
        class : 'same-report-selector',
        onChange : function (reportId) {
          topic.publish('openFile', reportId, null, that.listOfBugsGrid);
        },

        refreshOptions : function (reportData) {
          //--- Get same reports by bughash in all reports ---//

          var reportFilter = new CC_OBJECTS.ReportFilter();
          reportFilter.reportHash = [reportData.bugHash];

          var sortMode = new CC_OBJECTS.SortMode();
          sortMode.type = CC_OBJECTS.SortType.FILENAME;
          sortMode.ord = CC_OBJECTS.Order.ASC;

          var res = CC_SERVICE.getRunResults(
            null,
            CC_OBJECTS.MAX_QUERY_SIZE,
            0,
            [sortMode],
            reportFilter, null);

          var runFilter = new CC_OBJECTS.RunFilter();
          runFilter.ids = res.map(function (report) { return report.runId; });

          var runDataSet = CC_SERVICE.getRunData(runFilter);

          var options = res.map(function (reportData) {
            var filename = reportData.checkedFile.replace(/^.*[\\\/]/, '');
            var run = runDataSet.filter(function (r) {
              return r.runId === reportData.runId;
            })[0];

            return {
              label : run.name + ':' + filename + ':' + reportData.line,
              value : reportData.reportId
            };
          });

          this.set('options', options);
          this.set('value', reportData.reportId, false);
        }
      }, sameReportSelector);

      //--- Same reports by bughash selector ---//

      this._sameReportSelector.refreshOptions(this.reportData);

      this.codeMirror = new CodeMirror(this.domNode, {
        matchBrackets : true,
        lineNumbers : true,
        readOnly : true,
        mode : 'text/x-c++src',
        foldGutter : true,
        gutters : ['CodeMirror-linenumbers', 'bugInfo'],
        extraKeys : {},
        viewportMargin : 500
      });

      this.codeMirror.on('viewportChange', function (cm, from, to) {
        that._lineDrawer(from, to);
      });

      on(document, 'keydown', function (event) {
        if (event.ctrlKey && event.keyCode === 13) // Enter
          that.codeMirror.execCommand('findPersistentNext');

        if (event.ctrlKey && event.keyCode === 70) { // Ctrl-f
          event.preventDefault();
          that.codeMirror.execCommand('findPersistent');
        }
      });
    },

    resize : function () {
      this.inherited(arguments);
      this._refresh();
    },

    drawBugPath : function (linesNeeded, bubblesNeeded) {
      var that = this;

      if (linesNeeded === undefined) linesNeeded = true;
      if (bubblesNeeded === undefined) bubblesNeeded = true;

      if (!linesNeeded && !bubblesNeeded)
        return;

      this.clearBubbles();
      this.clearLines();

      function filterFunction(obj) {
        return obj.fileId === that.sourceFileData.fileId;
      }

      var reportDetails = CC_SERVICE.getReportDetails(this.reportData.reportId);

      var points = reportDetails.executionPath.filter(filterFunction);
      reportDetails.pathEvents.map(function (evt, index) {
        evt.bugEventNumber = index + 1;
      });

      var bubbles = reportDetails.pathEvents.filter(filterFunction);

      // This is needed because CodeChecker gives different positions.
      points.forEach(function (point) { --point.startCol; });
      points.forEach(function (bubble) { --bubble.startCol; });

      if (bubblesNeeded) {
        that.addBubbles(bubbles);
        that.addOtherFileBubbles(reportDetails.executionPath);
      }

      if (linesNeeded)
        that.addLines(points);
    },

    addBubbles : function (bubbles) {
      var that = this;

      that.codeMirror.operation(function () {
        bubbles.forEach(function (bubble, i) {
          var isResult = i === bubbles.length - 1;

          var left = that.codeMirror.defaultCharWidth() * bubble.startCol + 'px';

          var enumType = isResult
            ? 'error' : bubble.msg.indexOf(' (fixit)') > -1
            ? 'fixit' : 'info';

          var enumeration =
            createBugStepEnumeration(bubble.bugEventNumber, enumType).outerHTML;

          var element = dom.create('div', {
            style : 'margin-left: ' + left,
            class : 'check-msg ' + enumType,
            idx : bubble.bugEventNumber,
            innerHTML : (bubbles.length !== 1 ? enumeration : '')
                      + parseBugStepMsg(entities.encode(bubble.msg))
          });

          that._lineWidgets.push(that.codeMirror.addLineWidget(
            bubble.startLine - 1, element));
        });
      });
    },

    addOtherFileBubbles : function (path) {
      var that = this;

      that.codeMirror.operation(function () {
        for (var i = 1; i < path.length; ++i) {
          if (path[i].fileId !== that.sourceFileData.fileId &&
              path[i].fileId !== path[i - 1].fileId) {
            var element = dom.create('div', {
              class : 'otherFileMsg',
              innerHTML : 'bugpath in:<br>' + path[i].filePath.split('/').pop(),
              onclick : (function (i) {
                return function () {
                  that.set(
                    'sourceFileData',
                    CC_SERVICE.getSourceFileData(path[i].fileId, true));
                  that.drawBugPath();
                  that.jumpTo(path[i].startLine, path[i].startCol);
                };
              })(i)
            });

            that._lineWidgets.push(that.codeMirror.addLineWidget(
              path[i - 1].startLine - 1, element));
          }
        }
      });
    },

    clearBubbles : function () {
      this._lineWidgets.forEach(function (widget) { widget.clear(); });
      this._lineWidgets = [];
    },

    addLines : function (points) {
      var that = this;

      that.codeMirror.operation(function () {
        points.forEach(function (p, i) {
          that._lineMarks.push(that.codeMirror.doc.markText(
            { line : p.startLine - 1, ch : p.startCol + 1 },
            { line : p.endLine - 1,   ch : p.endCol       },
            { className : 'checkerstep' }));
        });
      });

      var range = this.codeMirror.getViewport();
      this._lineDrawer(range.from, range.to);
    },

    clearLines : function () {
      this._lineMarks.forEach(function (mark) { mark.clear(); });
      this._lineMarks = [];
      resetJsPlumb(this);
    },

    highlightCurrentBubble : function (idx) {
      this._lineWidgets.forEach(function (widget) {
        var lineIdx = widget.node.getAttribute('idx');
        domClass.toggle(widget.node, 'current', parseInt(lineIdx) === idx);
      });
    },

    jumpTo : function (line, column) {
      var that = this;

      setTimeout(function () {
        var selPosPixel
          = that.codeMirror.charCoords({ line : line, ch : column }, 'local');
        var editorSize = {
          width : style.get(that.domNode, 'width'),
          height : style.get(that.domNode, 'height')
        };

        that.codeMirror.scrollIntoView({
          top    : selPosPixel.top - 100,
          bottom : selPosPixel.top + editorSize.height - 150,
          left   : selPosPixel.left < editorSize.width - 100
                 ? 0
                 : selPosPixel.left - 50,
          right  : selPosPixel.left < editorSize.width - 100
                 ? 10
                 : selPosPixel.left + editorSize.width - 100
        });
      }, 0);
    },

    highlightBugPathEvent : function (bugPathEvent) {
      if (this._currentLineMark)
        this._currentLineMark.clear();

      this._currentLineMark = this.codeMirror.doc.markText(
        { line : bugPathEvent.startLine - 1, ch : bugPathEvent.startCol - 1 },
        { line : bugPathEvent.endLine - 1,   ch : bugPathEvent.endCol       },
        { className : 'currentMark' });
    },

    _setContentAttr : function (content) {
      this.codeMirror.doc.setValue(content);
      this._refresh();
    },

    _setFilepathAttr : function (filepath) {
      this.filepath.innerHTML = filepath;
    },

    _setSourceFileDataAttr : function (sourceFileData) {
      this.sourceFileData = sourceFileData;
      this.set('content', sourceFileData.fileContent);
      this.set('filepath', sourceFileData.filePath);
      this.jumpTo(this.reportData.line, 0);
    },

    _refresh : function () {
      var that = this;
      setTimeout(function () {
        var fullHeight = parseInt(style.getComputedStyle(that.domNode).height);
        var headerHeight = getFullHeight(that.header);

        that.codeMirror.setSize('100%', (fullHeight - headerHeight) + 'px');
        that.codeMirror.refresh();
      }, 0);
    },

    _lineDrawer : function (from, to) {
      if (this._lineMarks.length === 0)
        return;

      var that = this;

      /**
       * This function returns the <span> element which belongs to the given
       * textmarker.
       * @param {TextMarker} textMarker CodeMirror object.
       * @return {Object|Null} A DOM object which belongs to the given text
       * marker or null if not found.
       * @pre This function assumes that the "spans" and "markers" variables
       * contain the corresponding DOM elements and markers at the same
       * position.
       */
      function getSpanToMarker(textMarker) {
        for (var line in markers) {
          var idx = markers[line].indexOf(textMarker);
          if (idx !== -1)
            return spans[line][idx];
        }
        return null;
      }

      var cmLines = query(
        '.CodeMirror-code', this.codeMirror.getWrapperElement())[0].children;
      var spans = {};
      var markers = {};

      this._lineMarks.forEach(function (textMarker) {
        // If not in viewport
        try {
          var line = textMarker.lines[0].lineNo();
        } catch (ex) {
          return;
        }

        if (line < from || line >= to)
          return;

        spans[line] = [];
        query('.checkerstep', cmLines[line - from]).forEach(function (step) {
          var count
            = (step.getAttribute('class').match(/checkerstep/g) || []).length;
          for (var i = 0; i < count; ++i)
            spans[line].push(step);
        });

        if (markers[line])
          markers[line].push(textMarker);
        else
          markers[line] = [textMarker];
      });

      // Sort the markers by the position of their start point in the given
      // line, so that they are placed on the same index as the corresponding
      // <span> element in the array "spans".
      for (var line in markers)
        markers[line].sort(function (left, right) {
          return left.find().from.ch - right.find().from.ch;
        });

      resetJsPlumb(this);

      var prev;
      this._lineMarks.forEach(function (textMarker) {
        var current = getSpanToMarker(textMarker);

        if (!current)
          return;

        if (prev)
          that.jsPlumbInstance.connect({
            source : prev,
            target : current
          });

        prev = current;
      });
    }
  });

  var BugStoreModelTree = declare(HtmlTree, {
    constructor : function (args) {
      dojo.safeMixin(this, args);

      var that = this;

      this.bugStore = new Observable(new Memory({
        data : [{ id : 'root' }],
        getChildren : function (node) {
          if (node.getChildren)
            return node.getChildren(node);

          return this.query({ parent : node.id });
        }
      }));

      this.model = new ObjectStoreModel({
        store : that.bugStore,
        query : { id : 'root' },
        mayHaveChildren : function (item) {
          return !item.isLeaf;
        }
      });
    },

    postCreate : function () {
      this.inherited(arguments);
      this.loadBugStoreData();

      // When loaded from URL then report data is originally a number.
      // When loaded by clicking on a table row, then severity is already
      // changed to its string representation.
      if (typeof this.reportData.severity === 'number')
        this.reportData.severity
          = util.severityFromCodeToString(this.reportData.severity);

      var isResolved =
        this.reportData.detectionStatus === CC_OBJECTS.DetectionStatus.RESOLVED;

      this.set('path', [
        'root',
        isResolved ? 'resolved' : this.reportData.severity,
        this.reportData.reportId + '',
        this.reportData.reportId + '_0'
      ]);

      topic.publish("hooks/report/Opened", this.reportData);
      var that = this;

      setTimeout(function () {
        that.editor.highlightBugPathEvent({
          startLine : that.reportData.line, startCol : that.reportData.column,
          endLine   : that.reportData.line, endCol   : that.reportData.column
        });
      }, 0);
    },

    /**
     * We get a reference to the report data field of the actually selected
     * item. On review status change we update this reference.
     */
    onLoad : function () {
      var items = this.bugStore.query({ parent : this.reportData.reportId });
      if (items.length) {
        this.reportData = items[0].report;
        this.buttonPane.set('reportData', this.reportData);
      }
    },

    loadBugStoreData : function () {
      var that = this;

      [
        { id : 'root',        name : 'Bugs by priority' },
        { id : 'critical',    name : 'Critical',    parent : 'root', isLeaf : false, kind : 'severity' },
        { id : 'high',        name : 'High',        parent : 'root', isLeaf : false, kind : 'severity' },
        { id : 'medium',      name : 'Medium',      parent : 'root', isLeaf : false, kind : 'severity' },
        { id : 'low',         name : 'Low',         parent : 'root', isLeaf : false, kind : 'severity' },
        { id : 'style',       name : 'Style',       parent : 'root', isLeaf : false, kind : 'severity' },
        { id : 'unspecified', name : 'Unspecified', parent : 'root', isLeaf : false, kind : 'severity' },
        { id : 'resolved'   , name : 'Resolved'   , parent : 'root', isLeaf : false, kind : 'resolved' }
      ].forEach(function (item) {
        that.bugStore.put(item);
      });

      var fileFilter = new CC_OBJECTS.ReportFilter();
      fileFilter.filepath = [getProperFilePath(this.reportData.checkedFile)];

      CC_SERVICE.getRunResults(
        this.runResultParam.runIds,
        CC_OBJECTS.MAX_QUERY_SIZE,
        0,
        null,
        fileFilter,
        null,
        function (result) {
          result.sort(function (r1, r2) {
            // Order reports by line.
            return r1.line - r2.line;
          }).forEach(function (report) { that._addReport(report); });

          that.bugStore.query({ parent : 'root' }).forEach(function (severity) {
            if (that.bugStore.query({ parent : severity.id }).length === 0)
              that.bugStore.remove(severity.id);
          });
        });
    },

    onClick : function (item) {
      if (!item.isLeaf)
        return;

      var that = this;

      if (item.bugPathEvent) {
        var fileId = item.bugPathEvent.fileId;
        var line = item.bugPathEvent.startLine;
        var column = item.bugPathEvent.startCol;
      } else {
        var fileId = item.report.fileId;
        var line = item.report.line;
        var column = item.report.column;
      }

      var isOtherFile = fileId !== this.editor.get('sourceFileData').fileId;
      var isOtherReport = item.parent != this.editor.get('reportData').reportId;

      if (isOtherFile)
        this.editor.set(
          'sourceFileData',
          CC_SERVICE.getSourceFileData(fileId, true));

      if (isOtherReport) {
        this.editor.set('reportData', item.report);
        this.buttonPane.set('reportData', item.report);
        hashHelper.setStateValues({
          'report': item.report.reportId,
          'reportHash': item.report.bugHash
        });
      }

      if (this.reportId !== item.report.reportId)
        topic.publish('showComments', item.report.reportId, this.editor);

      this.reportId = item.report.reportId;

      if (isOtherFile || isOtherReport)
        // TODO: Now arrows are redrawn only if new file is opened. But what if
        // in the same file the path goes out of the CodeMirror-rendered area?
        this.editor.drawBugPath(
          this.buttonPane.showArrowCheckbox.get('checked'));

      this.editor.jumpTo(line, column);

      var eventToMark;
      if (item.bugPathEvent) {
        eventToMark = item.bugPathEvent;
      } else {
        eventToMark = {
          startLine : item.report.line, startCol : item.report.column,
          endLine   : item.report.line, endCol   : item.report.column
        };
      }
      this.editor.highlightBugPathEvent(eventToMark);
      this.editor.highlightCurrentBubble(item.idx);

      topic.publish("hooks/bugpath/EventClicked", {
        id    : item.id.split('_')[1],
        event : item.bugPathEvent
      });

      //--- Same reports by bughash selector ---//

      this.editor._sameReportSelector.refreshOptions(item.report);
    },

    getIconClass : function(item, opened) {
      if (item == this.model.root) {
        return (opened ? "dijitFolderOpened" : "dijitFolderClosed");
      } else if (!item.isLeaf) {
        switch (item.kind) {
          case 'severity':
            return "customIcon icon-severity-" + item.id;
          case 'resolved':
            return 'customIcon detection-status-resolved';
          case 'bugpath':
            var status =
              util.detectionStatusFromCodeToString(item.report.detectionStatus);

            return 'customIcon detection-status-' + status.toLowerCase() + ' '
              + (opened ? 'pathOpened' : 'pathClosed');
          default:
            return (opened ? "dijitFolderOpened" : "dijitFolderClosed");
        }
      } else if (item.isLeaf) {
        switch (item.kind) {
          case 'msg':
            return "customIcon assume_msg nocolor";
          case 'event':
            return (item.iconOverride ? "customIcon " + item.iconOverride
                                      : "customIcon msg");
          case 'result':
            return "customIcon result";
          default:
            return "dijitLeaf";
        }
      }
    },

    _onNodeMouseEnter : function (node) {
      if (node.item.tooltip)
        Tooltip.show(node.item.tooltip, node.labelNode, ['above']);
    },

    _onNodeMouseLeave : function (node) {
      if (node.item.isLeaf)
        Tooltip.hide(node.labelNode);
    },

    // Highlight colours go further down this array in a circular fashion
    // at each function call.
    _highlight_colours : [
      "#ffffff",
      "#e9dddd",
      "#dde0eb",
      "#e5e8e5",
      "#cbc2b6",
      "#b8ccea",
      "#c1c9cd",
      "#a7a28f"
    ],

    _highlightStep : function(stack, step) {
      var that = this;
      var msg = step.msg;

      // The background must be saved BEFORE stack transition.
      // Calling is in the caller, return is in the called func, not "outside"
      var highlight = {
        background : stack.background,
        iconOverride : undefined
      };

      function extractFuncName(prefix) {
        if (msg.startsWith(prefix)) {
          return msg.replace(prefix, "").replace(/'/g, "");
        }
      }

      var func;
      if (func = extractFuncName("Calling ")) {
        stack.funcStack.push(func);
        stack.background = that._highlight_colours[
          stack.funcStack.length % that._highlight_colours.length];

        highlight.iconOverride = "calling";
      } else if (msg.startsWith("Entered call from ")) {
        highlight.iconOverride = "entered_call";
      } else if (func = extractFuncName("Returning from ")) {
        if (func === stack.funcStack[stack.funcStack.length - 1]) {
          stack.funcStack.pop();
          stack.background = that._highlight_colours[
            stack.funcStack.length % that._highlight_colours.length];

          highlight.iconOverride = "returning";
        } else {
          throw {
            name : 'StackError',
            message : "Returned from " + func + " while the last function " +
                      "was " + stack.funcStack[stack.funcStack.length - 1]
          };
        }
      } else if (msg.startsWith("Assuming the condition")) {
        highlight.iconOverride = "assume_switch";
      } else if (msg.startsWith("Assuming")) {
        highlight.iconOverride = "assume_exclamation";
      } else if (msg == "Entering loop body") {
        highlight.iconOverride = "loop_enter";
      } else if (msg.startsWith("Loop body executed")) {
        highlight.iconOverride = "loop_execute";
      } else if (msg == "Looping back to the head of the loop") {
        highlight.iconOverride = "loop_back";
      }

      return highlight;
    },

    _formatReportDetails : function (report, reportDetails) {
      var res = [];

      res.push({
        id : report.reportId + '_0',
        name : '<b><u>' + entities.encode(report.checkerMsg) + '</u></b>',
        parent : report.reportId + '',
        report : report,
        isLeaf : true,
        idx : reportDetails.pathEvents.length,
        kind : 'msg'
      });

      if (reportDetails.pathEvents.length <= 1)
        return res;

      var filePaths = [];
      var areThereMultipleFiles = false;
      var highlightStack = {
        funcStack : [],
        background : this._highlight_colours[0]
      };

      // Check if there are multiple files (XTU?) affected by this bug.
      // If so, we show the file names properly.
      reportDetails.pathEvents.some(function (step) {
        if (filePaths.indexOf(step.filePath) === -1) {
          // File is not yet in the array, put it in.
          filePaths.push(step.filePath);
        } else {
          if (filePaths.length !== 1) {
            areThereMultipleFiles = true;
            return true; // Break execution, multiple files were found
          }
        }

        return false; // Continue checking
      });

      var that = this;
      reportDetails.pathEvents.forEach(function (step, index) {
        var isResult = index == reportDetails.pathEvents.length - 1;

        var filename = step.filePath.replace(/^.*(\\|\/|\:)/, '');
        var highlightData = that._highlightStep(highlightStack, step);

        var enumType = isResult
          ? 'error' : step.msg.indexOf(' (fixit)') > -1
          ? 'fixit' : 'info';

        var enumeration =
          createBugStepEnumeration(index + 1, enumType).outerHTML;

        var name = enumeration
          + (areThereMultipleFiles ? '{FILENAME}:' : 'L')
          + step.startLine + ' &ndash; '
          + parseBugStepMsg(entities.encode(step.msg));

        var kind = 'event';
        if (isResult) {
          // The final line in the BugPath is the result once again
          name = '<i><u>' + name + '</u></i>';
          kind = 'result';
        }

        // Tooltip and name should have the same formatting,
        // but tooltip contains the full filename
        var tooltip = name.replace('{FILENAME}', filename);

        if (filename.length > 12) {
          var extensionParts = filename.split('.');
          var fnWithoutExt = extensionParts.slice(0, extensionParts.length)
                                           .join('.');
          var extension = (extensionParts.length > 1
                           ? '.' + extensionParts[extensionParts.length - 1]
                           : '');

          name = name.replace('{FILENAME}',
                              fnWithoutExt.substr(0, 8) + "..." + extension);
        } else {
          name = name.replace('{FILENAME}', filename);
        }

        res.push({
          id : report.reportId + '_' + (index + 1),
          name : name,
          idx : (index + 1),
          tooltip : tooltip,
          backgroundColor : highlightData.background,
          iconOverride : highlightData.iconOverride,
          parent : report.reportId,
          bugPathEvent : step,
          isLeaf : true,
          kind : kind,
          report : report
        });
      });

      return res;
    },

    _addReport : function (report) {
      var that = this;

      var parent = report.detectionStatus === CC_OBJECTS.DetectionStatus.RESOLVED
        ? 'resolved'
        : util.severityFromCodeToString(report.severity);

      this.bugStore.put({
        id : report.reportId + '',
        name : 'L' + report.line
             + ' &ndash; ' + report.checkerId,
        parent : parent,
        report : report,
        isLeaf : false,
        kind : 'bugpath',
        getChildren : function (node) {
          var reportDetails = CC_SERVICE.getReportDetails(report.reportId);
          return that._formatReportDetails(report, reportDetails);
        }
      });
    },

    openOnClick : true,
    showRoot : false
  });

  var ChangeReviewStatusDialog = declare(Dialog, {
    constructor : function () {
      var that = this;

      this._messageBox = new SimpleTextarea({
        placeholder : '(Optionally) Explain the status change...',
        onKeyPress : function (e) {
          var value = this.get('value');

          // Accept ENTER as submit if nothing is entered into text area.
          if (e.keyCode === keys.ENTER && !value.trim().length) {
            that._messageBox.set('value', '');
            that.changeReviewStatus();
            dojo.stopEvent(e);
          }
        }
      });

      this._changeButton = new Button({
        label : 'Change',
        onClick : function () {
          that.changeReviewStatus();
        }
      });
    },

    changeReviewStatus : function () {
      var message = this._messageBox.get('value');
      var status = this.reviewStatusSelector.get('value');

      var user = CC_AUTH_SERVICE.getLoggedInUser();
      if (!user)
        user = 'Anonymous';

      //--- Update the current report data ---//

      this.buttonPane.reportData.reviewData.comment = message;
      this.buttonPane.reportData.reviewData.status = status;
      this.buttonPane.reportData.reviewData.author = user;
      this.buttonPane.reportData.reviewData.date = new Date();

      this.buttonPane.showReviewStatusMessageBox(message);

      //--- Change the review status. ---//

      CC_SERVICE.changeReviewStatus(this.buttonPane.reportData.reportId,
        status, message);

      //--- Hide the dialog. ---//

      this.hide();
    },

    onShow : function () {
      this._messageBox.set('value', '');
    },

    onCancel : function () {
      this.reviewStatusSelector.reset();
    },

    postCreate : function () {
      this.inherited(arguments);

      this.addChild(this._messageBox);
      this.addChild(this._changeButton);
    }
  });

  var ButtonPane = declare(ContentPane, {
    style : 'padding: 2px',

    constructor : function (args) {
      dojo.safeMixin(this, args);

      var that = this;

      //--- Bug review status ---//

      this._reviewStatusDialog = new ChangeReviewStatusDialog({
        title      : 'Change review status',
        reportData : this.reportData,
        buttonPane : this
      });

      this._reviewStatusSelector = new Select({
        class     : 'review-status-options',
        options   : this._createOptionValues(),
        value     : that.reportData.reviewData.status,
        prevValue : that.reportData.reviewData.status,
        onChange : function () {
          that._reviewStatusDialog.show();
        },
        reset : function () {
          this.set('value', this.prevValue, false);
        }
      });

      this._reviewComment = dom.create('span', {
        class : 'customIcon review-comment',
        mouseover : function () {
          var content = util.reviewStatusTooltipContent(
            that.reportData.reviewData);

          Tooltip.show(content.outerHTML, this, ['below']);
        },
        mouseout : function () {
          Tooltip.hide(this);
        }
      });

      this._reviewStatusDialog.set('reviewStatusSelector',
        this._reviewStatusSelector);
    },

    postCreate : function () {
      var that = this;

      //--- Documentation ---//

      this.addChild(new Button({
        label : 'Show documentation',
        onClick : function () {
          topic.publish('showDocumentation', that.reportData.checkerId);
        }
      }));

      this.addChild(this._reviewStatusSelector);

      //--- Review status comment message. ---//

      dom.place(this._reviewComment, this.domNode);

      //--- Comments ---//

      var toggler = new dojo.fx.Toggler({
        node: that.commentView.domNode,
        showFunc: dojo.fx.wipeIn,
        hideFunc: dojo.fx.wipeOut,
        showDuration: 0,
        hideDuration: 0
      });

      this.addChild(new Button({
        class      : 'comment-btn',
        postCreate : function () {
          this._subscribeTopics();
          toggler.hide();
        },

        _subscribeTopics : function () {
          var _that = this;

          topic.subscribe('showComments', function (reportId, sender) {
            if (sender !== that.editor)
              return;

            var count = CC_SERVICE.getCommentCount(reportId);
            _that.set('label', 'Comments'
              + '<span class="comment-count">(' + count + ')</span>');
          });
        },

        onClick : function () {
          if (this.hide) {
            toggler.hide();
            this.hide = false;
          } else {
            toggler.show();
            this.hide = true;
          }
          that.main.resize();
        }
      }));

      //--- Show arrows ---//

      this.showArrowCheckbox = new CheckBox({
        checked : true,
        style : 'margin: 5px;',
        onChange : function (checked) {
          if (checked)
            that.editor.drawBugPath();
          else {
            that.editor.clearLines();
          }
        }
      });

      this.addChild(this.showArrowCheckbox);

      var label = dom.create('label', {
        for : this.showArrowCheckbox.get('id'),
        innerHTML : 'Show arrows'
      });

      dom.place(label, this.showArrowCheckbox.domNode, 'after');
    },

    _createOptionValues : function () {
      var reviewStatusOptions = [];
      for (var key in CC_OBJECTS.ReviewStatus) {
        var value = CC_OBJECTS.ReviewStatus[key];
        reviewStatusOptions.push({
          label : '<span class="customIcon ' + util.reviewStatusCssClass(value)
                + '"></span>' + util.reviewStatusFromCodeToString(value),
          value : value
        });
      }
      return reviewStatusOptions;
    },

    /**
     * This function fires when we set the reportData field of a ButtonPane
     * object.
     */
    _setReportDataAttr : function (report) {
      this.reportData = report;

      //--- Update the select widget values ---//

      this._reviewStatusSelector.set('options', this._createOptionValues());
      this._reviewStatusSelector.set('value',
        report.reviewData.status, false);
      this._reviewStatusSelector.set('prevValue',
        report.reviewData.status, false);

      //--- Show or hide review status message box ---//

      this.showReviewStatusMessageBox(report.reviewData.comment);
    },

    /**
     * Show or hide the review status message box if the review status is
     * unreviewed.
     */
    showReviewStatusMessageBox : function (message) {
        domClass.toggle(this._reviewComment, 'hide',
          !this.reportData.reviewData.author);
    }
  });

  return declare(BorderContainer, {
    design : 'sidebar',

    postCreate : function () {
      var that = this;

      //--- Editor ---//

      this._editor = new Editor({
        region : 'center',
        reportData : this.reportData,
        listOfBugsGrid : this.listOfBugsGrid
      });

      CC_SERVICE.getSourceFileData(this.reportData.fileId, true, null,
      function (sourceFileData) {
        that._editor.set('sourceFileData', sourceFileData);
        that._editor.drawBugPath();
      });

      this.addChild(this._editor);

      //--- Comments ---//

      this._commentView = new CommentView({
        class    : 'comment-view',
        region   : 'right',
        style    : 'width: 300px;',
        sender   : this._editor
      });

      this.addChild(this._commentView);

      //--- Buttons ---//

      var buttonPane = new ButtonPane({
        region      : 'top',
        reportData  : this.reportData,
        editor      : this._editor,
        commentView : this._commentView,
        main        : this
      });

      this.addChild(buttonPane);

      //--- Tree ---//

      var bugStoreModelTree = new BugStoreModelTree({
        region : 'left',
        splitter : true,
        reportData : this.reportData,
        style : 'width: 300px;',
        editor : this._editor,
        buttonPane : buttonPane,
        runResultParam : this.runResultParam
      });

      this.addChild(bugStoreModelTree);
    }
  });
});
