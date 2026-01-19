import { drizzle } from "drizzle-orm/mysql2";
import { departments, documentationSources } from "../drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Create default departments (use workspace ID 1 for default workspace)
    const deptResults = await db
      .insert(departments)
      .values([
        {
          workspaceId: 1,
          name: "IT",
          description: "Information Technology support for hardware, software, and network issues",
        },
        {
          workspaceId: 1,
          name: "HR",
          description: "Human Resources support for benefits, policies, and employee matters",
        },
        {
          workspaceId: 1,
          name: "Finance",
          description: "Finance support for expenses, reimbursements, and financial processes",
        },
      ])
      .onDuplicateKeyUpdate({
        set: {
          description: departments.description,
        },
      });

    console.log("✅ Departments created/updated");

    // Get department IDs
    const allDepts = await db.select().from(departments);
    const itDept = allDepts.find((d) => d.name === "IT");
    const hrDept = allDepts.find((d) => d.name === "HR");
    const financeDept = allDepts.find((d) => d.name === "Finance");

    // Add IT documentation
    if (itDept) {
      await db
        .insert(documentationSources)
        .values([
          {
            departmentId: itDept.id,
            title: "Password Reset Procedure",
            content: `How to reset your password:
1. Go to the identity management portal
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for reset link
5. Follow the link and create a new password
6. Password must be at least 12 characters with mixed case and numbers

If you don't receive the email, check your spam folder or contact IT support.`,
            category: "Authentication",
            isActive: true,
          },
          {
            departmentId: itDept.id,
            title: "VPN Connection Guide",
            content: `Setting up VPN access:
1. Download VPN client from IT portal
2. Install and run the application
3. Enter your network credentials
4. Select the appropriate VPN profile
5. Click Connect

Troubleshooting:
- If connection fails, restart the client
- Ensure you're using the latest version
- Check firewall settings
- Contact IT if issues persist`,
            category: "Network",
            isActive: true,
          },
          {
            departmentId: itDept.id,
            title: "Software Installation Request",
            content: `To request software installation:
1. Submit a request through the IT portal
2. Provide software name and version
3. Explain business justification
4. Wait for approval (usually 2-3 business days)
5. IT will install once approved

Common approved software:
- Microsoft Office Suite
- Adobe Creative Cloud
- Development tools (VS Code, Git, etc.)
- Communication tools (Slack, Teams)

For security concerns, IT may deny requests.`,
            category: "Software",
            isActive: true,
          },
        ])
        .onDuplicateKeyUpdate({
          set: {
            content: documentationSources.content,
          },
        });

      console.log("✅ IT documentation added");
    }

    // Add HR documentation
    if (hrDept) {
      await db
        .insert(documentationSources)
        .values([
          {
            departmentId: hrDept.id,
            title: "Benefits Enrollment Guide",
            content: `Annual benefits enrollment:
1. Open enrollment period: January 1-15
2. Access benefits portal with your credentials
3. Review current and new plan options
4. Make selections for health, dental, vision
5. Submit by January 15 deadline

Key dates:
- Enrollment: January 1-15
- Coverage effective: February 1
- Changes take effect next month

Questions? Contact HR at hr@company.com`,
            category: "Benefits",
            isActive: true,
          },
          {
            departmentId: hrDept.id,
            title: "Time Off Request Process",
            content: `Requesting time off:
1. Log into the HR portal
2. Click "Request Time Off"
3. Select dates and type (vacation, sick, personal)
4. Add optional notes
5. Submit to your manager
6. Manager approves/denies within 2 business days

Time off types:
- Vacation: 20 days per year
- Sick: 10 days per year
- Personal: 3 days per year
- Holidays: Company-observed holidays

Unused vacation days: Can carry over up to 5 days`,
            category: "Time Off",
            isActive: true,
          },
          {
            departmentId: hrDept.id,
            title: "Company Policies",
            content: `Key company policies:
- Work hours: 9 AM - 5 PM (flexible start times available)
- Remote work: Up to 3 days per week
- Dress code: Business casual
- Code of conduct: Professional and respectful behavior
- Anti-discrimination: Zero tolerance policy

For full policy details, visit the HR portal or contact HR.`,
            category: "Policies",
            isActive: true,
          },
        ])
        .onDuplicateKeyUpdate({
          set: {
            content: documentationSources.content,
          },
        });

      console.log("✅ HR documentation added");
    }

    // Add Finance documentation
    if (financeDept) {
      await db
        .insert(documentationSources)
        .values([
          {
            departmentId: financeDept.id,
            title: "Expense Reimbursement Process",
            content: `Submitting expenses for reimbursement:
1. Gather all receipts (must be original or scanned)
2. Log into the expense portal
3. Create new expense report
4. Add expenses with category and receipt
5. Submit to manager for approval
6. Finance processes within 5-7 business days

Reimbursable expenses:
- Client entertainment
- Travel (airfare, hotel, meals)
- Office supplies
- Conference registration
- Professional development

Non-reimbursable:
- Personal items
- Alcohol (except business meals)
- Parking/commute costs`,
            category: "Expenses",
            isActive: true,
          },
          {
            departmentId: financeDept.id,
            title: "Purchase Order Process",
            content: `Creating a purchase order:
1. Identify vendor and item needed
2. Get quote from vendor
3. Submit PO request in finance system
4. Include vendor info and pricing
5. Get manager approval
6. Finance approves and sends to vendor

PO thresholds:
- Under $500: Manager approval only
- $500-$5000: Manager + Finance approval
- Over $5000: Manager + Finance + Director approval

Approved vendors list available in finance portal.`,
            category: "Procurement",
            isActive: true,
          },
          {
            departmentId: financeDept.id,
            title: "Payroll Information",
            content: `Payroll details:
- Pay frequency: Bi-weekly (every other Friday)
- Direct deposit: Set up in HR portal
- Pay stubs: Available in HR portal
- Tax withholding: Update through HR portal
- Deductions: Health insurance, 401(k), etc.

If you have payroll questions:
- Contact Finance department
- Email: payroll@company.com
- Phone: ext. 5000

Direct deposit setup:
- Provide bank account and routing number
- Takes 1-2 pay cycles to activate
- Update anytime in HR portal`,
            category: "Payroll",
            isActive: true,
          },
        ])
        .onDuplicateKeyUpdate({
          set: {
            content: documentationSources.content,
          },
        });

      console.log("✅ Finance documentation added");
    }

    console.log("✨ Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
