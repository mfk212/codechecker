User Guide
==========

**CodeChecker** is a static analysis infrastructure built on the [LLVM/Clang
Static Analyzer](http://clang-analyzer.llvm.org) toolchain, alternative tool for
[`scan-build`](http://clang-analyzer.llvm.org/scan-build.html) in a Linux or
macOS (OS X) development environment.

<div class="github">More descriptions and guides available
<a href="https://github.com/Ericsson/codechecker/blob/master/README.md">
on GitHub</a>
</div>

Table of Contents
=================

* [Products](#userguide-products)
  * [Managing products](#userguide-managing-products)
  * [Managing permissions](#userguide-managing-permissions)
* [List of runs](#userguide-list-of-runs)
  * [Filter runs](#userguide-filter-runs)
  * [Compare runs](#userguide-compare-runs)
  * [Delete runs](#userguide-delete-runs)
  * [Sorting runs](#userguide-sorting-runs)
* [Checker statistics](#userguide-checker-statistics)
* [Analysis results](#userguide-analysis-results)
  * [Filtering](#userguide-filtering)
  * [Detection status](#userguide-detection-status)
  * [Severity levels](#userguide-severity-levels)
* [Bug view](#userguide-bug-view)
  * [Report navigation tree](#userguide-report-navigation-tree)
  * [Button pane](#userguide-button-pane)
     * [Show documentation](#show-documentation)
     * [Review status](#userguide-review-status)
  * [Same reports](#userguide-same-reports)
  * [Bug path view](#userguide-bug-path-view)
  * [Comment](#userguide-comment)
* [Run history](#userguide-run-history)

# <a name="userguide-user-guide"></a> Products
The product system allows a single CodeChecker server to serve multiple separate
result databases, named "products", under the same IP address and authentication
domain.

## <a name="userguide-managing-products"></a> Managing products
![Products](images/products.png)

After enabling the administrative actions by clicking on the
*Show administration* button in the top right corner, click *Add new product*,
then fill the form presented. The values that need to be filled here are the
same as the arguments for `CodeChecker cmd products add`.
These buttons are visible only for *Super Users*.

![New product](images/new_product.png)

If the product creation is successful, the window will disappear and the
product will appear in the product list.

Editing a product is done through the pencil icon, which is visible when
administrative actions are enabled. This window lets you edit the product's
configuration.

![Edit product](images/edit_product.png)

Products can be deleted by clicking on the red trash bin. This way the product
is only unmounted from the server (losing access control data and connection),
but **no analysis results are deleted**.

![Remove product](images/remove_product.png)

## <a name="userguide-managing-permissions"></a> Managing permissions
* Server-wide permissions can be edited by clicking *Edit global permissions*.
* Product-level permissions can be edited by clicking the edit icon for the
product you want to configure the permissions.

From the dropdown, select the permission you want to configure. The two lists
show the users and groups known to the system - if a tick is present in its row,
the given user or group has the permission directly granted. (Users who only
have a certain permission through permission inheritance are not shown with a
tick.)

![Global permissions](images/product_global_permissions.png)

Only the permissions you have rights to manage are shown in the dropdown.

You can edit multiple permissions opening the window only once. Simply tick or
untick the users/groups you want to give the permission to or revoke from them.
Clicking *OK* will save the changes to the database.

# <a name="userguide-list-of-runs"></a> List of runs
List page contains the analysis runs available on the server under the selected
product.

You can do the following on this page:
- [Filter runs](#userguide-filtering).
- [Compare analysis](#userguide-compare-runs).
- [Delete runs](#userguide-delete-runs).
- [Sorting runs](#userguide-sorting-runs).

![Runs](images/runs.png)

## <a name="userguide-filter-runs"></a> Filter runs
You can filter runs by run name using the input box above the run list table.
The filter is **case insensitive** and doing a **substring matching**. If we
start typing some phrase in this input box, the list are being _filtered
automatically_. 

## <a name="userguide-compare-runs"></a> Compare runs
Calculates difference between two analyses of the project, showing which bugs
have been fixed and which are newly introduced.

## <a name="userguide-delete-runs"></a> Delete runs
You can delete multiple runs by selecting them and clicking on the Delete
button. It will remove the run and all related data from the database.

## <a name="userguide-sorting-runs"></a> Sorting runs
It is possible to change the order of the runs by clicking on a cell at header
of the run list table. For example, you can sort the run list by the number of
bugs or the run name.

# <a name="userguide-checker-statistics"></a> Checker statistics
A statistical overview can be seen under "Checker statistics" panel. In
this table you can see the number of reports by checkers based on some
attributes of the report like severity, and report status.

![Checker statistics](images/checker_statistics.png)

# <a name="userguide-analysis-results"></a> Analysis results
If you select a run at the [list of runs](#userguide-list-of-runs) view, you get
to this page. This page lists the analysis result for the given run.

![Reports](images/reports.png)

## <a name="userguide-filtering"></a> Filtering
When opening the bug list view under "All reports" tab or by clicking a specific
run or by opening "diff view" between two runs then the following filter options
are available:
- **Run name**: You can select one or more run names. The result list is
restricted on the findings in these runs. By selecting a specific run in the
"runs" view this field is filled by default. In "All reports" tab no run is
selected in which case the reports from all runs are visible.
- [**Review status**](#userguide-review-status): You can select the reports with
the given review status to check only *False positive*, *Unreviewed*, etc.
reports.
- [**Detection status**](#userguide-detection-status): You can select the
reports with the given detection status to check only *Unresolved*, *Resolved*,
etc. reports.
- [**Severity**](#userguide-severity-levels): The nature of the bugs is sorted
in different severity levels. For example, a division by zero or a null pointer
dereference is more serious than an unused variable. By this field you can
select the reports on the given severity levels.
- **Run tag**: When runs are stored in update mode (i.e. on the same run name),
then the specific runs can be tagged in order to be easier to identify them.
By this field you can select the reports found during a specific run event.
- **Detection date**: A date interval can also restrict the list of displayed
bug reports. In this field you can choose the date of detection or fixing.
- **File**: You can choose a set of files to restrict the list of bug reports.
- **Checker name**: If you are interested in specific type of bugs then here you
can choose them.
- **Checker message**: The static analysis tools provide a message to indicate
the reason of a specific bug. This message is also filterable.

In "diff view" instead of "run name" you have the following filter fields:
- **Baseline**: The runs against which you want to check the difference.
- **Newcheck**: The runs which you want to compare against the baseline runs.
- **Diff type**: Here you can set if you'd like to see the bugs which appear
only in the **Baseline**, **Newcheck** or both.

When you select a filter option on any field then a number indicates on the
right side of the option the number of reports which belong to that specific
option.

At the top of the filter panel there is a "Unique reports" checkbox. This
narrows the report list to unique bug. The same bug may appear several times if
it is found on different control paths, i.e. through different function calls.
By checking "Unique reports" a report appears only once even if it is found on
several paths.

## <a name="userguide-detection-status"></a> Detection status
The detection status is the state of a bug report in a run. When
storing the results of a run from scratch then each report has
detection status <span class="customIcon detection-status-new"></span> **New**.
When the reports stored again with the same run name then the detection status
can change to one of the following options:
- <span class="customIcon detection-status-resolved"></span> **Resolved**: when
the bug report can't be found after the subsequent storage.
- <span class="customIcon detection-status-unresolved"></span> **Unresolved**:
when the bug report is still among the results after the subsequent storage.
- <span class="customIcon detection-status-reopened"></span> **Reopened**: when
a resolved bug appears again.

## <a name="userguide-severity-levels"></a> Severity levels
We are mapping checker names to different severity levels:
- <span class="customIcon icon-severity-unspecified"></span> **Unspecified**
- <span class="customIcon icon-severity-style"></span> **Style**:
(E.g. _modernize-raw-string-literal, modernize-use-auto, etc._)
- <span class="customIcon icon-severity-low"></span> **Low**
(E.g. _deadcode.DeadStores, misc-unused-parameters, etc._)
- <span class="customIcon icon-severity-medium"></span> **Medium**:
(E.g. _unix.Malloc, core.uninitialized.Assign, etc._)
- <span class="customIcon icon-severity-high"></span> **High**:
(E.g. _core.DivideZero, core.NullDereference, cplusplus.NewDelete, etc._)
- <span class="customIcon icon-severity-critical"></span> **Critical**

# <a name="userguide-bug-view"></a> Bug view
At this page you can navigate between reports and check the errors what
CodeChecker found.

This page has four main parts:
- [Report navigation tree](#userguide-report-navigation-tree)
- [Button pane](#userguide-button-pane)
- [Bug path view](#userguide-bug-path-view)
- [Comments](#userguide-comment)

![Report view](images/report_view.png)

## <a name="userguide-report-navigation-tree"></a> Report navigation tree
Report Navigation Tree shows the found reports at the currently opened file. The
reports are grouped by the severity level.
You can navigate between them by clicking on a node in the tree.

![Report navigation tree](images/report_navigation_tree.png)

## <a name="userguide-button-pane"></a> Button pane
Button Pane contains several items which help you to change or get some
property of the currently opened report. 
![Button pane](images/button_pane.png)

### <a name="show-documentation"></a> Show documentation
Show Documentation button shows the documentation of the actual checker which
identified by the currently opened report.
![Checker documentation](images/checker_documentation.png)

### <a name="userguide-review-status"></a> Review status
Reports can be assigned a review status of Unreviewed, Confirmed bug, False
positive, Intentional, along with an optional comment on why this status was
applied.
- <span class="customIcon review-status-unreviewed"></span> **Unreviewed**
(_default_): Nobody has seen this report.
- <span class="customIcon review-status-confirmed-bug"></span> **Confirmed**:
This is really a bug.
- <span class="customIcon review-status-false-positive"></span>
**False positive**: This is not a bug. Before marking a bug false positive
you should read the [false positive how to](https://github.com/Ericsson/codechecker/blob/master/docs/false_positives.md).
- <span class="customIcon review-status-intentional"></span> **Intentional**:
This report is a bug but we don't want to fix it.

We can change the review status from the default
<span class="customIcon review-status-unreviewed"></span> _Unreviewed_ option
to something else in the report details view above the file view.
![Unreviewed](images/review_status_unreviewed.png)

If you changed the review status, you can optionally explain the reason why
you changed it.
![Change review status](images/review_status_change.png)

If somebody has already changed the review status from the default one, you can
see extra information (who changed the review status, when and why) beside
the review status selector by hovering on the message icon. This message icon is
hidden by default if nobody has changed the review status.
![Review status message](images/review_status_message.png)

## <a name="userguide-same-reports"></a> Same reports
Several reports may belong to a specific bug if the but itself can be reached on
different control paths. In the Bug viewer you can check whether the selected
bug is available on a different path.

![Same reports](images/same_reports.png)

## <a name="userguide-bug-path-view"></a> Bug path view
Some checkers are able to follow the execution path along the control flow of
the program. If a bug appears on any of these paths, then CodeChecker is able to
present the full path on which this so called symbolic execution reached the
place of error. This path can be checked in this bug path view.

![Bug path](images/bug_path.png)

## <a name="userguide-comment"></a> Comment
Bug reports can be commented. You can add new comments,
edit (<span class="customIcon edit" style="padding:0px"></span>) and
delete (<span class="customIcon delete" style="padding:0px"></span>) them.

The author of the comment will be the currently logged in user. If the user is
not logged in, the author of the comment will be _Anonymous_.

Comments are shown for the same report found in multiple runs.

![Comment](images/comment.png)

# <a name="userguide-run-history"></a> Run history
When selecting a run then a "Run history" tab appears next to the
*Bug overview*. In this window you can check the specific run events which
happened during a storage process under the same run name. This way you can list
the reports' state in the selected run event.

![Run history](images/run_history.png)
