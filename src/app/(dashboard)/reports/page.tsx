'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, Filter, FileSpreadsheet, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('campaigns');
  const [dateRange, setDateRange] = useState('7d');
  const [format, setFormat] = useState('csv');

  const reportTypes = [
    { value: 'campaigns', label: 'Campaign Performance', description: 'Views, clicks, CTR, revenue by campaign' },
    { value: 'groups', label: 'Group Analytics', description: 'Performance metrics per Telegram group' },
    { value: 'revenue', label: 'Revenue Report', description: 'Detailed revenue breakdown by deal' },
    { value: 'models', label: 'Model Performance', description: 'OnlyFans model conversion metrics' },
    { value: 'casinos', label: 'Casino Performance', description: 'Casino brand performance metrics' },
    { value: 'creatives', label: 'Creative Analysis', description: 'A/B test results and engagement' },
  ];

  const recentReports = [
    { name: 'Campaign Report - Jan 2025', date: '2025-01-20', size: '2.4 MB', format: 'csv' },
    { name: 'Revenue Summary - Q4 2024', date: '2025-01-15', size: '1.8 MB', format: 'xlsx' },
    { name: 'Group Analytics - December', date: '2025-01-10', size: '3.1 MB', format: 'csv' },
    { name: 'Model Performance - 2024', date: '2025-01-05', size: '4.2 MB', format: 'json' },
  ];

  const generateReport = () => {
    const selectedReport = reportTypes.find(r => r.value === reportType);
    toast.success(`Generating ${selectedReport?.label}...`);
  };

  const getFormatIcon = (fmt: string) => {
    switch (fmt) {
      case 'csv':
      case 'xlsx':
        return <FileSpreadsheet className="h-4 w-4" />;
      case 'json':
        return <FileJson className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Exports</h1>
          <p className="text-muted-foreground">
            Generate and download performance reports
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reports Generated</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156 MB</div>
            <p className="text-xs text-muted-foreground">of 1 GB</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Auto-reports</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Export</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2h ago</div>
            <p className="text-xs text-muted-foreground">Campaign report</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Report
            </CardTitle>
            <CardDescription>
              Create a new report with your selected parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Report Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30">
              <div className="font-medium mb-1">
                {reportTypes.find(r => r.value === reportType)?.label}
              </div>
              <div className="text-sm text-muted-foreground">
                {reportTypes.find(r => r.value === reportType)?.description}
              </div>
            </div>

            <Button onClick={generateReport} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>
              Previously generated reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentReports.map((report, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getFormatIcon(report.format)}
                    <div>
                      <div className="text-sm font-medium">{report.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {report.date} · {report.size}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="uppercase text-xs">
                    {report.format}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle>Scheduled Reports</CardTitle>
          <CardDescription>
            Automatically generated reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Weekly Campaign Summary</span>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Every Monday at 9:00 AM
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Recipients: admin@company.com
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Monthly Revenue Report</span>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                1st of each month
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Recipients: finance@company.com
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Daily Performance Digest</span>
                <Badge variant="secondary">Paused</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Every day at 6:00 PM
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Recipients: team@company.com
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
