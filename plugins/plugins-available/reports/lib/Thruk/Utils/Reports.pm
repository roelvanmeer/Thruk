package Thruk::Utils::Reports;

=head1 NAME

Thruk::Utils::Reports - Utilities Collection for Reporting

=head1 DESCRIPTION

Utilities Collection for Reporting

=cut

use warnings;
use strict;
use Carp;
use Class::Inspector;
use File::Slurp;
use Data::Dumper;
use Thruk::Utils::CLI;
use Thruk::Utils::PDF;

##########################################################

=head1 METHODS

=head2 report_show

  report_show($c, $nr)

generate and show the report

=cut
sub report_show {
    my($c, $nr, $options) = @_;

    my $report   = _read_report_file($c, $nr);
    return unless defined $report;

    if(!defined $report) {
        Thruk::Utils::set_message( $c, 'fail_message', 'no such report' );
        return $c->response->redirect('reports.cgi');
    }

    my $pdf_file = generate_report($c, $nr, $report);
    if(defined $pdf_file) {
        $c->stash->{'pdf_template'} = 'passthrough_pdf.tt';
        $c->stash->{'pdf_file'}     = $pdf_file;
        $c->stash->{'pdf_filename'} = $report->{'name'}.'.pdf'; # downloaded filename
        $c->forward('View::PDF::Reuse');
    }
    return 1;
}

##########################################################

=head2 report_update

  report_update($c, $nr, $name, $params)

update report

=cut
sub report_update {
    my($c, $nr, $name, $template, $params, $backends) = @_;
    my $file = $c->config->{'var_path'}.'/reports/'.$nr.'.txt';
    if(-f $file) {
        my $report = _read_report_file($c, $nr);
        return unless defined $report;
    }
    my $report = {
        name     => $name,
        template => $template,
        user     => $c->stash->{'remote_user'},
        params   => $params,
    };
    $report->{'backends'} = $backends if defined $backends;
    my $data = Dumper($report);
    $data    =~ s/^\$VAR1\ =\ //mx;
    $data    =~ s/^\ \ \ \ \ \ \ \ //gmx;
    open(my $fh, '>'.$file) or confess('cannot write to '.$file.": ".$!);
    print $fh $data;
    close($fh);
    return 1;
}

##########################################################

=head2 report_remove

  report_remove($c, $nr)

remove report

=cut
sub report_remove {
    my($c, $nr) = @_;

    my $file = $c->config->{'var_path'}.'/reports/'.$nr.'.txt';
    return 1 unless -f $file;
    return 1 if unlink($file);
    return;
}

##########################################################

=head2 generate_report

  generate_report($c, $nr, $options)

generate a new report

=cut
sub generate_report {
    my($c, $nr, $options) = @_;
    $Thruk::Utils::PDF::c = $c;
    $Thruk::Utils::CLI::c = $c;

    $c->stats->profile(begin => "Utils::Reports::generate_report()");
    $options = _read_report_file($c, $nr) unless defined $options;
    return unless defined $options;

    unless ($c->user_exists) {
        $ENV{'REMOTE_USER'} = $options->{'user'};
        $c->authenticate( {} );
    }

    if(defined $options->{'backends'}) {
        $c->{'db'}->disable_backends();
        $c->{'db'}->enable_backends($options->{'backends'});
    }

    # set some defaults
    Thruk::Utils::PDF::set_unavailable_states([qw/DOWN UNREACHABLE CRITICAL UNKNOWN/]);
    $c->{'request'}->{'parameters'}->{'show_log_entries'}           = 1;
    $c->{'request'}->{'parameters'}->{'assumeinitialstates'}        = 'yes';
    $c->{'request'}->{'parameters'}->{'initialassumedhoststate'}    = 3; # UP
    $c->{'request'}->{'parameters'}->{'initialassumedservicestate'} = 6; # OK


    $c->stash->{'param'} = $options->{'params'};
    for my $p (keys %{$options->{'params'}}) {
        $c->{'request'}->{'parameters'}->{$p} = $options->{'params'}->{$p};
    }

    if(!defined $options->{'template'} or !Thruk::Utils::PDF::path_to_template('pdf/'.$options->{'template'})) {
        confess('template pdf/'.$options->{'template'}.' does not exist');
    }

    # set some render helper
    for my $s (@{Class::Inspector->functions('Thruk::Utils::PDF')}) {
        $c->stash->{$s} = \&{'Thruk::Utils::PDF::'.$s};
    }

    # prepare pdf
    $c->stash->{'pdf_template'} = 'pdf/'.$options->{'template'};
    $c->stash->{'block'} = 'prepare';
    eval {
        $c->view("PDF::Reuse")->render_pdf($c);
    };
    Thruk::Utils::CLI::_error($@) if $@;
    return if $@;

    # render pdf
    $c->stash->{'block'} = 'render';
    my $pdf_data;
    eval {
        $pdf_data = $c->view("PDF::Reuse")->render_pdf($c);
    };
    Thruk::Utils::CLI::_error($@) if $@;
    return if $@;

    # write out pdf
    mkdir($c->config->{'tmp_path'}.'/reports');
    my $pdf_file = $c->config->{'tmp_path'}.'/reports/'.$nr.'.pdf';
    open(my $fh, '>', $pdf_file);
    binmode $fh;
    print $fh $pdf_data;
    close($fh);

    $c->stats->profile(end => "Utils::Reports::generate_report()");
    return $pdf_file;
}

##########################################################

=head2 get_report_data_from_param

  get_report_data_from_param($params)

return report data for given params

=cut
sub get_report_data_from_param {
    my $params = shift;

    my $name     = $params->{'name'}     || 'New Report';
    my $template = $params->{'template'} || 'sla.tt';
    # TODO: implement
    my $backends = undef;

    my $data     = {};
    for my $key (keys %{$params}) {
        next unless $key =~ m/^params\.(\w+)$/mx;
        $data->{$1} = $params->{$key};
    }

    return($name, $template, $data, $backends);
}

##########################################################
sub _read_report_file {
    my($c, $nr) = @_;
    unless($nr =~ m/^\d+$/mx) {
        Thruk::Utils::CLI::_error("not a valid report number");
        return;
    }
    my $file = $c->config->{'var_path'}.'/reports/'.$nr.'.txt';
    unless(-f $file) {
        Thruk::Utils::CLI::_error("report does not exist: $!");
        return;
    }
    my $data = read_file($file);
    my $report;
    ## no critic
    eval('$report = '.$data.';');
    ## use critic

    return unless _is_authorized_for_report($c, $report);

    return $report;
}

##########################################################
sub _is_authorized_for_report {
    my($c, $report) = @_;
    return 1 if defined $ENV{'THRUK_SRC'} and $ENV{'THRUK_SRC'} eq 'CLI';
    if(defined $report->{'user'} and defined $c->stash->{'remote_user'} and $report->{'user'} eq $c->stash->{'remote_user'}) {
        return 1;
    }
    Thruk::Utils::CLI::_debug("user: ".$c->stash->{'remote_user'}." is not authorized for report");
    return;
}

##########################################################

1;
